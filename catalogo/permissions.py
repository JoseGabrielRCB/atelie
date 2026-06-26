"""Permissões por papel do painel (a fonte da verdade das permissões).

Cada endpoint protegido valida o papel lido de ``request.user.perfil``. Esconder
itens na UI é só conveniência — quem decide o acesso é o backend, aqui.

Papéis (fixos):
- **Dono**: acesso total (catálogo/estoque/encomendas + Vendas/financeiro +
  Funcionários + Configurações de WhatsApp/pagamento).
- **Funcionário**: catálogo/estoque/encomendas/categorias/cores/destaques; Vendas
  só se ``acesso_financeiro=True``; NUNCA Funcionários nem Configurações.

Um usuário com ``perfil.ativo == False`` é tratado como sem perfil (bloqueado).
Superuser sem ``Perfil`` (ex.: ``createsuperuser`` após a migração) é tratado
como Dono ativo, para não travar o acesso administrativo.
"""

from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Perfil


def perfil_efetivo(user):
    """Devolve o ``Perfil`` ativo do usuário, ou ``None`` se bloqueado/anônimo.

    - Anônimo → ``None``.
    - Perfil inativo (``ativo=False``) → ``None`` (bloqueado em todo o painel).
    - Superuser sem perfil → um ``Perfil`` virtual de Dono (não persistido).
    """
    if not user or not user.is_authenticated:
        return None
    perfil = getattr(user, "perfil", None)
    if perfil is not None:
        return perfil if perfil.ativo else None
    if user.is_superuser:
        # Superuser criado fora do fluxo (sem Perfil) age como Dono ativo.
        return Perfil(usuario=user, papel=Perfil.Papel.DONO, ativo=True)
    return None


def eh_dono(user) -> bool:
    perfil = perfil_efetivo(user)
    return bool(perfil and perfil.eh_dono)


def pode_financeiro(user) -> bool:
    perfil = perfil_efetivo(user)
    return bool(perfil and perfil.pode_financeiro)


# Mensagem única quando o staff ainda não trocou a senha provisória.
MSG_SENHA_PROVISORIA = "Troque sua senha provisória para continuar."


def senha_provisoria_pendente(user) -> bool:
    """True se o staff precisa trocar a senha provisória antes de usar o painel.

    Bloqueia os endpoints do painel até a troca (reforça no backend o que o front
    já faz). Os endpoints de troca/identidade (``/me/``, ``/me/senha/``, refresh)
    usam ``IsAuthenticated`` e NÃO passam por estas permissões — seguem liberados.
    """
    perfil = perfil_efetivo(user)
    return bool(perfil and perfil.senha_provisoria)


class EhEquipeAtiva(BasePermission):
    """Permite a qualquer membro ativo da equipe (Dono ou Funcionário)."""

    message = "Você não tem acesso a esta área do painel."

    def has_permission(self, request, view):
        if perfil_efetivo(request.user) is None:
            return False
        if senha_provisoria_pendente(request.user):
            self.message = MSG_SENHA_PROVISORIA
            return False
        return True


class LeituraPublicaEscritaEquipe(BasePermission):
    """Leitura pública (vitrine); escrita só para a equipe ativa.

    Substitui o ``IsAuthenticatedOrReadOnly`` nos recursos de catálogo/estoque/
    categorias/cores/destaques: GET/HEAD/OPTIONS livres; POST/PUT/PATCH/DELETE
    exigem Dono ou Funcionário ativo.
    """

    message = "Você não tem permissão para alterar este conteúdo."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        if perfil_efetivo(request.user) is None:
            return False
        if senha_provisoria_pendente(request.user):
            self.message = MSG_SENHA_PROVISORIA
            return False
        return True


class PodeFinanceiro(BasePermission):
    """Vendas/financeiro: Dono, ou Funcionário com ``acesso_financeiro=True``."""

    message = "Você não tem acesso ao financeiro (Vendas)."

    def has_permission(self, request, view):
        if not pode_financeiro(request.user):
            return False
        if senha_provisoria_pendente(request.user):
            self.message = MSG_SENHA_PROVISORIA
            return False
        return True


class SoDono(BasePermission):
    """Áreas exclusivas do Dono: Funcionários e Configurações (não liberáveis)."""

    message = "Apenas o dono tem acesso a esta área."

    def has_permission(self, request, view):
        if not eh_dono(request.user):
            return False
        if senha_provisoria_pendente(request.user):
            self.message = MSG_SENHA_PROVISORIA
            return False
        return True


def eh_cliente(user) -> bool:
    """True se ``user`` é uma conta de CLIENTE da loja (não staff/sem Perfil).

    Cliente = autenticado, com ``Cliente`` (OneToOne), ``is_staff=False`` e SEM
    ``Perfil``. Mantém o login do cliente separado do staff (e vice-versa).
    """
    if not (user and user.is_authenticated):
        return False
    if user.is_staff or getattr(user, "perfil", None) is not None:
        return False
    return getattr(user, "cliente", None) is not None


class EhCliente(BasePermission):
    """Conta de CLIENTE (área da conta do cliente e checkout). Staff é recusado."""

    message = "Entre com a sua conta de cliente para continuar."

    def has_permission(self, request, view):
        return eh_cliente(request.user)
