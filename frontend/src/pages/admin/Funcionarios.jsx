import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, KeyRound, Power, Check, Trash2, Wallet, WalletMinimal } from "lucide-react";
import {
  listarUsuarios,
  criarUsuario,
  atualizarUsuario,
  excluirUsuario,
} from "../../lib/api";
import { useOrdenacao, ordenarPor } from "../../hooks/useOrdenacao";
import { CabecalhoOrdenavel, OrdenarMobile } from "../../components/admin/CabecalhoOrdenavel";
import Modal from "../../components/admin/Modal";
import ConfirmarExclusao from "../../components/admin/ConfirmarExclusao";
import { Carregando, Erro, Vazio } from "../../components/Estado";
import {
  BotaoPrimario,
  BotaoSecundario,
  Campo,
  Feedback,
  Selo,
  inputClasse,
} from "../../components/admin/ui";

function dataCurta(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function Funcionarios() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "usuarios"], queryFn: listarUsuarios });
  const [busca, setBusca] = useState("");
  const [criar, setCriar] = useState(false);
  const [exclusao, setExclusao] = useState(null);
  const [senhaGerada, setSenhaGerada] = useState(null); // { usuario, senha }
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const ord = useOrdenacao("admin-funcionarios", { coluna: "criado_em", direcao: "desc" });

  const invalidar = () => qc.invalidateQueries({ queryKey: ["admin", "usuarios"] });

  const acaoMut = useMutation({
    mutationFn: ({ id, dados }) => atualizarUsuario(id, dados),
    onSuccess: (resp, variaveis) => {
      invalidar();
      if (resp?.senha_provisoria_gerada) {
        setSenhaGerada({ usuario: resp.usuario, senha: resp.senha_provisoria_gerada });
      } else if (variaveis?.dados?.ativo === false) {
        setOk("Funcionário desativado.");
      } else if (variaveis?.dados?.ativo === true) {
        setOk("Funcionário ativado.");
      } else if ("acesso_financeiro" in (variaveis?.dados ?? {})) {
        setOk(
          variaveis.dados.acesso_financeiro
            ? "Acesso ao financeiro liberado."
            : "Acesso ao financeiro revogado."
        );
      }
    },
    onError: (e) => setErro(e.message),
  });

  const todos = q.data ?? [];
  const filtrados = busca.trim()
    ? todos.filter((u) => {
        const alvo = `${u.nome ?? ""} ${u.usuario ?? ""} ${u.email ?? ""}`.toLowerCase();
        return alvo.includes(busca.trim().toLowerCase());
      })
    : todos;

  const lista = ordenarPor(filtrados, ord.ordenacao.coluna, ord.ordenacao.direcao, {
    nome: (u) => (u.nome || u.usuario || "").toLowerCase(),
    usuario: (u) => (u.usuario || "").toLowerCase(),
    papel: (u) => u.papel,
    ativo: (u) => (u.ativo ? 1 : 0),
    criado_em: (u) => u.criado_em ?? "",
  });

  function pedirExclusao(u) {
    setErro("");
    setOk("");
    setExclusao(u);
  }

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">Funcionários</h1>
        <BotaoPrimario
          type="button"
          onClick={() => {
            setErro("");
            setOk("");
            setCriar(true);
          }}
        >
          <Plus size={18} aria-hidden="true" />
          Novo funcionário
        </BotaoPrimario>
      </div>

      <p className="mb-4 text-sm text-texto-suave">
        Funcionários acessam catálogo, estoque, encomendas, categorias, cores e destaques. O
        acesso ao <strong className="text-texto">financeiro (Vendas)</strong> é liberado por
        conta. Funcionários e Configurações são exclusivos do dono.
      </p>

      <div className="mb-4 max-w-sm">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Ex.: nome ou usuário"
          aria-label="Buscar funcionário"
          className={inputClasse}
        />
      </div>

      {erro && (
        <div className="mb-4">
          <Feedback tipo="erro">{erro}</Feedback>
        </div>
      )}
      {ok && (
        <div className="mb-4">
          <Feedback tipo="sucesso">{ok}</Feedback>
        </div>
      )}

      {q.isLoading && <Carregando texto="Carregando funcionários..." />}
      {q.isError && <Erro mensagem={q.error.message} aoTentarNovamente={q.refetch} />}
      {!q.isLoading && !q.isError && lista.length === 0 && (
        <Vazio texto="Nenhum funcionário cadastrado ainda." />
      )}

      {lista.length > 0 && (
        <>
        <OrdenarMobile
          className="mb-3"
          ordenacao={ord.ordenacao}
          aoOrdenar={ord.alternar}
          colunas={[
            { coluna: "nome", rotulo: "Nome" },
            { coluna: "usuario", rotulo: "Usuário" },
            { coluna: "criado_em", rotulo: "Criado em" },
          ]}
        />
        <div className="sm:overflow-x-auto sm:rounded-lg sm:border sm:border-borda">
          <table className="tabela-cartoes w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-borda text-texto-suave">
              <tr>
                <CabecalhoOrdenavel coluna="nome" rotulo="Nome" ordenacao={ord.ordenacao} aoOrdenar={ord.alternar} />
                <CabecalhoOrdenavel coluna="usuario" rotulo="Usuário" ordenacao={ord.ordenacao} aoOrdenar={ord.alternar} />
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Financeiro</th>
                <CabecalhoOrdenavel coluna="criado_em" rotulo="Criado em" ordenacao={ord.ordenacao} aoOrdenar={ord.alternar} />
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {lista.map((u) => {
                const ocupado = acaoMut.isPending && acaoMut.variables?.id === u.id;
                return (
                  <tr key={u.id} className={u.ativo ? "" : "bg-borda/20"}>
                    <td className="cel-principal px-4 py-3 font-medium text-texto">
                      <span className="block max-w-[14rem] truncate" title={u.nome || "—"}>
                        {u.nome || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-texto-suave" data-rotulo="Usuário">
                      <span className="block max-w-[12rem] truncate" title={u.usuario}>
                        {u.usuario}
                      </span>
                    </td>
                    <td className="px-4 py-3" data-rotulo="Status">
                      {u.ativo ? (
                        <Selo cor="verde">Ativo</Selo>
                      ) : (
                        <Selo cor="cinza">Inativo</Selo>
                      )}
                    </td>
                    <td className="px-4 py-3" data-rotulo="Financeiro">
                      {u.acesso_financeiro ? (
                        <Selo cor="acento">Liberado</Selo>
                      ) : (
                        <span className="text-texto-suave">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-texto-suave" data-rotulo="Criado em">{dataCurta(u.criado_em)}</td>
                    <td className="cel-acoes px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() =>
                            acaoMut.mutate({
                              id: u.id,
                              dados: { acesso_financeiro: !u.acesso_financeiro },
                            })
                          }
                          aria-label={
                            u.acesso_financeiro
                              ? `Revogar financeiro de ${u.usuario}`
                              : `Liberar financeiro de ${u.usuario}`
                          }
                          title={u.acesso_financeiro ? "Revogar financeiro" : "Liberar financeiro"}
                          className="inline-flex items-center justify-center rounded-lg border border-borda p-1.5 text-texto-suave transition hover:border-acento-escuro hover:text-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro disabled:opacity-50"
                        >
                          {u.acesso_financeiro ? (
                            <WalletMinimal size={16} aria-hidden="true" />
                          ) : (
                            <Wallet size={16} aria-hidden="true" />
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => acaoMut.mutate({ id: u.id, dados: { resetar_senha: true } })}
                          aria-label={`Resetar senha de ${u.usuario}`}
                          title="Resetar senha"
                          className="inline-flex items-center justify-center rounded-lg border border-borda p-1.5 text-texto-suave transition hover:border-acento-escuro hover:text-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro disabled:opacity-50"
                        >
                          <KeyRound size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => acaoMut.mutate({ id: u.id, dados: { ativo: !u.ativo } })}
                          aria-label={u.ativo ? `Desativar ${u.usuario}` : `Ativar ${u.usuario}`}
                          title={u.ativo ? "Desativar" : "Ativar"}
                          className={
                            "inline-flex items-center justify-center rounded-lg border p-1.5 transition focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 " +
                            (u.ativo
                              ? "border-borda text-texto-suave hover:border-acento-escuro hover:text-acento-escuro focus-visible:ring-acento-escuro"
                              : "border-sucesso/40 text-sucesso hover:bg-sucesso/10 focus-visible:ring-sucesso")
                          }
                        >
                          {u.ativo ? <Power size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                        </button>
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => pedirExclusao(u)}
                          aria-label={`Excluir ${u.usuario}`}
                          title="Excluir"
                          className="inline-flex items-center justify-center rounded-lg border border-erro/40 p-1.5 text-erro transition hover:bg-erro/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-erro disabled:opacity-50"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      <FormFuncionario aberto={criar} aoFechar={() => setCriar(false)} aoCriar={setSenhaGerada} />

      <ConfirmarExclusao
        aberto={Boolean(exclusao)}
        aoFechar={() => setExclusao(null)}
        titulo="Excluir funcionário"
        itens={
          exclusao
            ? [{ chave: `user-${exclusao.id}`, titulo: `Funcionário "${exclusao.nome || exclusao.usuario}"` }]
            : []
        }
        alvos={exclusao ? [{ id: exclusao.id, rotulo: exclusao.usuario }] : []}
        excluir={excluirUsuario}
        aoConcluir={({ falhas }) => {
          invalidar();
          if (falhas.length) setErro("Não foi possível excluir o funcionário.");
          else setOk("Funcionário excluído.");
        }}
      />

      {/* Senha provisória gerada (criação ou reset): mostrada UMA vez ao dono. */}
      <Modal
        aberto={Boolean(senhaGerada)}
        aoFechar={() => setSenhaGerada(null)}
        titulo="Senha provisória"
        tamanho="sm"
      >
        {senhaGerada && (
          <div className="space-y-4">
            <p className="text-sm text-texto">
              Repasse esta senha provisória para{" "}
              <strong>{senhaGerada.usuario}</strong>. Ela será trocada no primeiro acesso.
            </p>
            <p className="rounded-lg border border-borda bg-fundo px-4 py-3 text-center font-mono text-lg font-semibold text-texto">
              {senhaGerada.senha}
            </p>
            <p className="text-xs text-texto-suave">
              Anote agora — por segurança, ela não será mostrada novamente.
            </p>
            <div className="flex justify-end">
              <BotaoPrimario type="button" onClick={() => setSenhaGerada(null)}>
                Entendi
              </BotaoPrimario>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}

// Modal de criação de funcionário (validação completa + confirmação ao salvar).
function FormFuncionario({ aberto, aoFechar, aoCriar }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ nome: "", usuario: "", email: "", senha: "" });
  const [financeiro, setFinanceiro] = useState(false);
  const [erros, setErros] = useState({});

  // Reseta ao (re)abrir, sem efeito (padrão do projeto).
  const [abertoAntes, setAbertoAntes] = useState(aberto);
  if (aberto !== abertoAntes) {
    setAbertoAntes(aberto);
    if (aberto) {
      setForm({ nome: "", usuario: "", email: "", senha: "" });
      setFinanceiro(false);
      setErros({});
    }
  }

  const mut = useMutation({
    mutationFn: () =>
      criarUsuario({
        nome: form.nome.trim(),
        usuario: form.usuario.trim(),
        email: form.email.trim(),
        senha: form.senha,
        acesso_financeiro: financeiro,
      }),
    onSuccess: (novo) => {
      qc.invalidateQueries({ queryKey: ["admin", "usuarios"] });
      aoFechar();
      // Confirmação: a senha provisória foi definida pelo dono (não geramos),
      // então só confirmamos. (Reset gera senha e mostra; criação não precisa.)
      aoCriar?.({ usuario: novo.usuario, senha: form.senha });
    },
    onError: (e) => {
      // Mapeia erros por campo do backend (usuario/email/senha) quando possível.
      const msg = e.message || "";
      const novos = {};
      if (/usu[aá]rio/i.test(msg)) novos.usuario = msg;
      else if (/e-?mail/i.test(msg)) novos.email = msg;
      else if (/senha/i.test(msg)) novos.senha = msg;
      else novos.geral = msg;
      setErros(novos);
    },
  });

  const definir = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  function enviar(e) {
    e.preventDefault();
    const novos = {};
    if (!form.usuario.trim()) novos.usuario = "Informe um nome de usuário.";
    if (!form.senha) novos.senha = "Defina uma senha provisória.";
    else if (form.senha.length < 8) novos.senha = "A senha deve ter ao menos 8 caracteres.";
    if (Object.keys(novos).length) {
      setErros(novos);
      return;
    }
    setErros({});
    mut.mutate();
  }

  const totalErros = Object.keys(erros).filter((k) => k !== "geral").length;

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Novo funcionário" tamanho="md">
      <form onSubmit={enviar} noValidate className="space-y-4">
        {(totalErros > 0 || erros.geral) && (
          <Feedback tipo="erro">
            {erros.geral ||
              `Há ${totalErros} ${totalErros === 1 ? "campo com problema" : "campos com problemas"}. Confira abaixo.`}
          </Feedback>
        )}

        <Campo label="Nome" htmlFor="func-nome">
          <input
            id="func-nome"
            value={form.nome}
            onChange={definir("nome")}
            maxLength={150}
            placeholder="Ex.: Ana Lima"
            className={inputClasse}
          />
        </Campo>

        <Campo label="Usuário (login)" htmlFor="func-usuario">
          <input
            id="func-usuario"
            value={form.usuario}
            onChange={definir("usuario")}
            maxLength={150}
            placeholder="Ex.: ana"
            autoCapitalize="none"
            className={inputClasse}
          />
          {erros.usuario && <p className="mt-1 text-sm text-erro">{erros.usuario}</p>}
        </Campo>

        <Campo label="E-mail (opcional)" htmlFor="func-email">
          <input
            id="func-email"
            type="email"
            value={form.email}
            onChange={definir("email")}
            placeholder="Ex.: ana@email.com"
            className={inputClasse}
          />
          {erros.email && <p className="mt-1 text-sm text-erro">{erros.email}</p>}
        </Campo>

        <Campo label="Senha provisória" htmlFor="func-senha" dica="O funcionário troca no primeiro acesso (mín. 8 caracteres).">
          <input
            id="func-senha"
            type="text"
            value={form.senha}
            onChange={definir("senha")}
            placeholder="Ex.: atelie-2026"
            className={inputClasse}
          />
          {erros.senha && <p className="mt-1 text-sm text-erro">{erros.senha}</p>}
        </Campo>

        <label className="flex items-center gap-2 text-sm text-texto">
          <input
            type="checkbox"
            checked={financeiro}
            onChange={(e) => setFinanceiro(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-acento-escuro)]"
          />
          Liberar financeiro (acesso à seção Vendas)
        </label>

        <div className="flex flex-col gap-3 border-t border-borda pt-4 sm:flex-row sm:justify-end">
          <BotaoSecundario type="button" onClick={aoFechar}>
            Cancelar
          </BotaoSecundario>
          <BotaoPrimario type="submit" disabled={mut.isPending}>
            {mut.isPending ? "Criando…" : "Criar funcionário"}
          </BotaoPrimario>
        </div>
      </form>
    </Modal>
  );
}
