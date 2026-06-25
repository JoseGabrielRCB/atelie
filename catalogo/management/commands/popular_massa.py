"""
Popula o banco com uma GRANDE MASSA de catálogo + encomendas, para testar a
reatividade do site/admin com volume.

Uso:
    python manage.py popular_massa                 # 120 peças, 40 encomendas
    python manage.py popular_massa --pecas 300 --encomendas 80
    python manage.py popular_massa --limpar        # DESTRUTIVO: apaga catálogo+encomendas antes

NÃO popula Funcionários/Perfil, Vendas (Pedido/ItemPedido) nem Cliente — vendas
não estão configuradas. As imagens são baixadas de uma API gratuita (loremflickr
com fallback picsum) e salvas no ImageField; falha de download de UMA imagem é
esperada (rede) e a peça segue sem ela (best-effort). Qualquer erro de banco/
validação NÃO é tratado: ele sobe e interrompe o comando (de propósito).

⚠️ São dados de TESTE. Antes de ir para produção, limpe com --limpar (ou recrie
o banco).
"""

import random
from datetime import timedelta
from decimal import Decimal

import requests
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from catalogo.models import (
    Categoria,
    Cor,
    Encomenda,
    EncomendaImagem,
    Imagem,
    Peca,
    Variacao,
)

# Categorias (nome único) + palavra-chave de imagem (loremflickr).
CATEGORIAS = [
    ("Vestidos", "dress"),
    ("Blusas", "blouse"),
    ("Saias", "skirt"),
    ("Calças", "pants"),
    ("Shorts", "shorts"),
    ("Conjuntos", "outfit"),
    ("Casacos", "coat"),
    ("Alfaiataria", "suit"),
    ("Infantil", "kids,clothing"),
    ("Acessórios", "accessories"),
]

# Paleta de cores (nome único + hex válido #RRGGBB).
CORES = [
    ("Preto", "#1A1816"),
    ("Branco", "#FFFFFF"),
    ("Bege", "#D8C3A5"),
    ("Terracota", "#B07A56"),
    ("Vinho", "#7B2D3A"),
    ("Azul Marinho", "#1F2A44"),
    ("Verde Musgo", "#4B5320"),
    ("Rosa", "#E8B4B8"),
    ("Mostarda", "#D4A017"),
    ("Cinza", "#8C887F"),
    ("Off-White", "#F7F5F1"),
    ("Caramelo", "#A8703E"),
]

# Tipos de peça por categoria, para nomes coerentes.
TIPOS_POR_CATEGORIA = {
    "Vestidos": ["Vestido", "Vestido Midi", "Vestido Longo", "Chemise"],
    "Blusas": ["Blusa", "Camisa", "Cropped", "Regata"],
    "Saias": ["Saia", "Saia Midi", "Saia Longa"],
    "Calças": ["Calça", "Calça Pantalona", "Calça Skinny"],
    "Shorts": ["Short", "Short Alfaiataria", "Bermuda"],
    "Conjuntos": ["Conjunto", "Twinset", "Conjunto Alfaiataria"],
    "Casacos": ["Casaco", "Trench Coat", "Sobretudo", "Kimono"],
    "Alfaiataria": ["Blazer", "Terno", "Colete", "Calça Social"],
    "Infantil": ["Vestido Infantil", "Conjunto Infantil", "Macacão Infantil"],
    "Acessórios": ["Lenço", "Cinto", "Bolsa", "Echarpe"],
}

ADJETIVOS = [
    "Floral", "Liso", "Listrado", "Acinturado", "Plissado", "Bordado",
    "Canelado", "Estampado", "Gola Alta", "Manga Bufante", "Godê", "Reto",
    "Oversized", "Slim", "Vintage", "Minimalista", "Boho", "Clássico",
    "Premium", "Leve", "Aconchegante", "Elegante",
]

TECIDOS = ["viscose", "linho", "algodão", "crepe", "malha", "alfaiataria", "tricoline", "sarja"]
CAIMENTOS = ["soltinho", "ajustado", "fluido", "estruturado", "confortável"]
OCASIOES = ["o dia a dia", "o trabalho", "festas", "o verão", "ocasiões especiais", "passeios"]

TAMANHOS = ["P", "M", "G", "GG", "Único", "38", "40", "42", "44"]

NOMES_FAKE = [
    "Ana Souza", "Beatriz Lima", "Carla Mendes", "Daniela Rocha", "Eduarda Alves",
    "Fernanda Castro", "Gabriela Dias", "Helena Martins", "Isabela Nunes", "Júlia Pires",
    "Larissa Gomes", "Mariana Costa", "Natália Freitas", "Patrícia Ramos", "Rafaela Teixeira",
    "Sofia Carvalho", "Tatiane Moraes", "Vanessa Barros", "Yasmin Cardoso", "Letícia Araújo",
]

DESC_ENCOMENDA_SIMPLES = [
    "Gostaria de um {peca} em {cor}, no tom da foto de referência.",
    "Quero um {peca} {adj} para usar em um casamento.",
    "Preciso de um {peca} sob medida, tecido leve, na cor {cor}.",
    "Tenho interesse em um {peca} parecido com o da foto, mas com manga.",
]

DESC_ENCOMENDA_MULTI = [
    "Quero um vestido + uma saia combinando, ambos em tom {cor}.",
    "Preciso de um conjunto: uma blusa e uma calça de alfaiataria.",
    "Gostaria de dois vestidos (um {cor} e um estampado) e um casaco por cima.",
    "Um blazer + uma calça social + um colete, para um look completo de trabalho.",
]

STATUS_ENCOMENDA = [
    Encomenda.Status.RECEBIDO,
    Encomenda.Status.RECEBIDO,
    Encomenda.Status.EM_ANDAMENTO,
    Encomenda.Status.CONCLUIDA,
    Encomenda.Status.CANCELADA,
]

TIMEOUT_IMAGEM = 8  # segundos por tentativa de download (best-effort)


class Command(BaseCommand):
    help = "Popula o banco com muito catálogo + encomendas (dados de TESTE) para avaliar volume."

    def add_arguments(self, parser):
        parser.add_argument("--pecas", type=int, default=120, help="Quantidade de peças (default 120).")
        parser.add_argument("--encomendas", type=int, default=40, help="Quantidade de encomendas (default 40).")
        parser.add_argument(
            "--limpar",
            action="store_true",
            help="DESTRUTIVO (opt-in): apaga TODO o catálogo (peças/variações/imagens) e as "
            "encomendas antes de popular. Não toca em Perfil/usuários/Pedido/Cliente.",
        )

    def handle(self, *args, **options):
        self.contador_nome = 1
        self.stats = {
            "categorias": 0,
            "cores": 0,
            "pecas": 0,
            "pronta": 0,
            "sob_medida": 0,
            "ativas": 0,
            "ocultas": 0,
            "destaque": 0,
            "variacoes": 0,
            "esgotadas": 0,
            "imagens_peca": 0,
            "imagens_falha": 0,
            "encomendas": 0,
            "encomendas_imagens": 0,
        }

        if options["limpar"]:
            self._limpar()

        cats = self._garantir_categorias()
        cores = self._garantir_cores()
        self._criar_pecas(options["pecas"], cats, cores)
        self._criar_encomendas(options["encomendas"])
        self._resumo()

    # ----------------------------------------------------------------- limpar
    def _limpar(self):
        self.stdout.write(self.style.WARNING("--limpar: apagando catálogo e encomendas (dados de teste)…"))
        # Encomenda → cascateia EncomendaImagem; Peca → cascateia Variacao/Imagem.
        # NÃO mexe em Perfil/User/Pedido/Cliente.
        Encomenda.objects.all().delete()
        Peca.objects.all().delete()
        self.stdout.write(self.style.WARNING("Catálogo e encomendas apagados."))

    # ------------------------------------------------------------- categorias
    def _garantir_categorias(self):
        cats = []
        for nome, keyword in CATEGORIAS:
            cat, criada = Categoria.objects.get_or_create(nome=nome)
            cats.append((cat, keyword))
            if criada:
                self.stats["categorias"] += 1
        return cats

    def _garantir_cores(self):
        cores = []
        for nome, hexv in CORES:
            cor, criada = Cor.objects.get_or_create(nome=nome, defaults={"hex": hexv})
            cores.append((cor.nome, cor.hex))
            if criada:
                self.stats["cores"] += 1
        return cores

    # ------------------------------------------------------------------ peças
    def _nome_unico(self, categoria_nome, usados):
        tipos = TIPOS_POR_CATEGORIA.get(categoria_nome, ["Peça"])
        while True:
            nome = f"{random.choice(tipos)} {random.choice(ADJETIVOS)} #{self.contador_nome}"
            self.contador_nome += 1
            if len(nome) > 80:
                nome = nome[:80]
            if nome not in usados and not Peca.objects.filter(nome=nome).exists():
                usados.add(nome)
                return nome

    def _descricao(self):
        return (
            f"Peça em {random.choice(TECIDOS)}, com caimento {random.choice(CAIMENTOS)}, "
            f"perfeita para {random.choice(OCASIOES)}. {random.choice(ADJETIVOS)} e versátil."
        )[:600]

    def _criar_pecas(self, quantidade, cats, cores):
        usados = set()
        self.stdout.write(f"Criando {quantidade} peças…")
        for i in range(quantidade):
            categoria, keyword = random.choice(cats)
            tipo = (
                Peca.Tipo.SOB_MEDIDA if random.random() < 0.15 else Peca.Tipo.PRONTA
            )
            ativo = random.random() > 0.15  # ~15% ocultas
            destaque = random.random() < 0.10  # ~10% em destaque
            preco = Decimal(random.randrange(3990, 199990)) / Decimal(100)  # 39,90–1.999,90

            with transaction.atomic():
                peca = Peca.objects.create(
                    nome=self._nome_unico(categoria.nome, usados),
                    descricao=self._descricao(),
                    preco=preco,
                    categoria=categoria,
                    tipo=tipo,
                    ativo=ativo,
                    destaque=destaque,
                )
                # criado_em é auto_now_add → espalha datas via UPDATE direto.
                data = timezone.now() - timedelta(
                    days=random.randint(0, 180), hours=random.randint(0, 23)
                )
                Peca.objects.filter(pk=peca.pk).update(criado_em=data)

                # Peça pronta: 1–5 variações (respeitando unique_together).
                if tipo == Peca.Tipo.PRONTA:
                    self._variacoes(peca, cores)

            # Imagens (best-effort, fora da transação por causa da rede).
            self._imagens_peca(peca, keyword)

            self.stats["pecas"] += 1
            self.stats["pronta" if tipo == Peca.Tipo.PRONTA else "sob_medida"] += 1
            self.stats["ativas" if ativo else "ocultas"] += 1
            if destaque:
                self.stats["destaque"] += 1

            if (i + 1) % 20 == 0 or (i + 1) == quantidade:
                self.stdout.write(f"  Criadas {i + 1}/{quantidade} peças…")

    def _variacoes(self, peca, cores):
        qtd = random.randint(1, 5)
        combos = set()
        novos = []
        tentativas = 0
        while len(novos) < qtd and tentativas < 30:
            tentativas += 1
            tamanho = random.choice(TAMANHOS)
            cor_nome, cor_hex = random.choice(cores)
            chave = (tamanho, cor_nome)
            if chave in combos:
                continue
            combos.add(chave)
            estoque = 0 if random.random() < 0.3 else random.randint(1, 40)
            novos.append(
                Variacao(
                    peca=peca,
                    tamanho=tamanho,
                    cor=cor_nome,
                    cor_hex=cor_hex,
                    estoque=estoque,
                )
            )
        Variacao.objects.bulk_create(novos)
        self.stats["variacoes"] += len(novos)
        self.stats["esgotadas"] += sum(1 for v in novos if v.estoque == 0)

    def _imagens_peca(self, peca, keyword):
        qtd = random.randint(1, 3)
        principal_definida = False
        for idx in range(qtd):
            conteudo = self._baixar_imagem(keyword, f"peca-{peca.pk}-{idx}")
            if conteudo is None:
                self.stats["imagens_falha"] += 1
                continue
            imagem = Imagem(peca=peca, principal=not principal_definida)
            imagem.arquivo.save(f"massa-{peca.pk}-{idx}.jpg", conteudo, save=True)
            principal_definida = True
            self.stats["imagens_peca"] += 1

    # ------------------------------------------------------------- encomendas
    def _criar_encomendas(self, quantidade):
        self.stdout.write(f"Criando {quantidade} encomendas…")
        for i in range(quantidade):
            cor = random.choice(CORES)[0]
            multi = random.random() < 0.4
            if multi:
                descricao = random.choice(DESC_ENCOMENDA_MULTI).format(cor=cor.lower())
            else:
                peca = random.choice(["vestido", "blazer", "saia", "conjunto", "casaco"])
                descricao = random.choice(DESC_ENCOMENDA_SIMPLES).format(
                    peca=peca, cor=cor.lower(), adj=random.choice(ADJETIVOS).lower()
                )

            tamanho_medidas = random.choice(
                [
                    "",
                    "Tamanho: M",
                    "Tamanho: G",
                    "Busto: 90 cm; Cintura: 70 cm; Quadril: 98 cm",
                    "Tamanho: 42; Comprimento: 110 cm",
                ]
            )
            prazo = None
            if random.random() < 0.5:
                prazo = (timezone.now() + timedelta(days=random.randint(7, 120))).date()

            with transaction.atomic():
                encomenda = Encomenda.objects.create(
                    nome=random.choice(NOMES_FAKE),
                    contato=self._contato_fake(),
                    descricao=descricao[:600],
                    tamanho_medidas=tamanho_medidas,
                    prazo_desejado=prazo,
                    status=random.choice(STATUS_ENCOMENDA),
                )
                data = timezone.now() - timedelta(
                    days=random.randint(0, 120), hours=random.randint(0, 23)
                )
                Encomenda.objects.filter(pk=encomenda.pk).update(criado_em=data)

            # Imagens de referência (0–3, best-effort).
            for idx in range(random.randint(0, 3)):
                conteudo = self._baixar_imagem("fashion", f"enc-{encomenda.pk}-{idx}")
                if conteudo is None:
                    self.stats["imagens_falha"] += 1
                    continue
                ref = EncomendaImagem(encomenda=encomenda)
                ref.arquivo.save(f"enc-massa-{encomenda.pk}-{idx}.jpg", conteudo, save=True)
                self.stats["encomendas_imagens"] += 1

            self.stats["encomendas"] += 1
            if (i + 1) % 10 == 0 or (i + 1) == quantidade:
                self.stdout.write(f"  Criadas {i + 1}/{quantidade} encomendas…")

    @staticmethod
    def _contato_fake():
        if random.random() < 0.3:
            return f"cliente{random.randint(1, 9999)}@email.com"
        return f"(67) 9{random.randint(1000, 9999)}-{random.randint(1000, 9999)}"

    # ------------------------------------------------------------------ imagem
    def _baixar_imagem(self, keyword, seed):
        """Baixa uma imagem (ContentFile) ou devolve None (best-effort de rede).

        Só engole erros de REDE/HTTP — nunca erros de banco. Tenta loremflickr
        (por palavra-chave) e cai para picsum.
        """
        urls = [
            f"https://loremflickr.com/600/800/{keyword},fashion?lock={random.randint(1, 99999)}",
            f"https://picsum.photos/seed/{seed}/600/800",
        ]
        for url in urls:
            try:
                resp = requests.get(url, timeout=TIMEOUT_IMAGEM)
            except requests.RequestException:
                continue
            if resp.status_code == 200 and resp.content:
                return ContentFile(resp.content)
        return None

    # ------------------------------------------------------------------ resumo
    def _resumo(self):
        s = self.stats
        self.stdout.write(self.style.SUCCESS("\n=== Resumo da população (dados de TESTE) ==="))
        self.stdout.write(f"Categorias novas:        {s['categorias']} (paleta de {len(CATEGORIAS)})")
        self.stdout.write(f"Cores novas:             {s['cores']} (paleta de {len(CORES)})")
        self.stdout.write(
            f"Peças criadas:           {s['pecas']} "
            f"(prontas {s['pronta']}, sob medida {s['sob_medida']}; "
            f"ativas {s['ativas']}, ocultas {s['ocultas']}, destaque {s['destaque']})"
        )
        self.stdout.write(f"Variações criadas:       {s['variacoes']} (esgotadas {s['esgotadas']})")
        self.stdout.write(f"Imagens de peça baixadas:{s['imagens_peca']}")
        self.stdout.write(f"Encomendas criadas:      {s['encomendas']}")
        self.stdout.write(f"Imagens de encomenda:    {s['encomendas_imagens']}")
        self.stdout.write(f"Downloads de imagem que falharam (pulados): {s['imagens_falha']}")
        self.stdout.write(
            self.style.WARNING(
                "Lembrete: dados de TESTE. Limpe com `python manage.py popular_massa --limpar` "
                "(ou recrie o banco) antes de produção."
            )
        )
