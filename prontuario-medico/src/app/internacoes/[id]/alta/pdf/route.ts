import { renderToBuffer } from "@react-pdf/renderer";
import type { NextRequest } from "next/server";
import { DocumentoAlta, type FolhaAlta, type Pessoa } from "@/features/impressao/documento-alta";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PERFIS_NAO_CLINICOS = ["recepcao", "admin"];
const NAO_ENCONTRADA = "Folha de alta não encontrada.";
const FALHA = "Não foi possível gerar o PDF.";

function pessoa(v: unknown): Pessoa | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const texto = (x: unknown) => (typeof x === "string" && x ? x : null);
  const nome = texto(o.nome);
  return nome
    ? { nome, conselho: texto(o.conselho), numero: texto(o.numero), uf: texto(o.uf) }
    : null;
}

/** resumo_alta e snapshot_alta ficam em internacoes_clinico (RLS clínica). snapshot_alta = { medico, equipe[] } (gravado por dar_alta). */
function lerSnapshot(valor: unknown): { medico: Pessoa | null; equipe: Pessoa[] } {
  const o = valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
  const equipe = Array.isArray(o.equipe)
    ? o.equipe.map(pessoa).filter((p): p is Pessoa => p !== null)
    : [];
  return { medico: pessoa(o.medico), equipe };
}

const cabecalhos = (extra: Record<string, string> = {}) => ({
  "Cache-Control": "no-store",
  ...extra,
});
const erro = (status: number, mensagem: string) =>
  Response.json({ erro: mensagem }, { status, headers: cabecalhos() });

/** Folha de alta (sem via, sem registro de impressão): mesmas checagens do PDF de evolução. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return erro(400, "Identificador de internação inválido.");

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return erro(401, "Não autenticado.");

  const { data: profissional } = await supabase
    .from("profissionais")
    .select("id, perfil, ativo")
    .eq("id", userId)
    .maybeSingle();
  if (!profissional?.ativo) return erro(401, "Não autenticado.");
  if (PERFIS_NAO_CLINICOS.includes(profissional.perfil))
    return erro(403, "Acesso restrito a profissionais clínicos.");

  const [
    { data: linha, error: erroLinha },
    { data: clinico, error: erroClinico },
  ] = await Promise.all([
    supabase
      .from("vw_internacoes_lista")
      .select(
        "internacao_id, nome, data_nascimento, convenio, leito_ala, equipe_nome, status, admitido_em, alta_em, tipo_alta",
      )
      .eq("internacao_id", id)
      .maybeSingle(),
    supabase
      .from("internacoes_clinico")
      .select("snapshot_alta, resumo_alta")
      .eq("internacao_id", id)
      .maybeSingle(),
  ]);
  if (erroLinha || erroClinico) return erro(500, FALHA);
  if (
    !linha ||
    linha.status !== "ALTA" ||
    !linha.alta_em ||
    !linha.tipo_alta ||
    !linha.nome ||
    !clinico?.resumo_alta
  ) {
    return erro(404, NAO_ENCONTRADA);
  }

  // Médico e equipe vêm só do snapshot gravado na alta (reimpressão não muda retroativamente).
  const snapshot = lerSnapshot(clinico?.snapshot_alta);
  const folha: FolhaAlta = {
    internacaoId: id,
    paciente: {
      nome: linha.nome,
      data_nascimento: linha.data_nascimento ?? "",
      convenio: linha.convenio ?? "",
    },
    leito_ala: linha.leito_ala ?? "",
    equipe_nome: linha.equipe_nome ?? "",
    admitido_em: linha.admitido_em ?? linha.alta_em,
    alta_em: linha.alta_em,
    tipo_alta: linha.tipo_alta,
    resumo: clinico.resumo_alta,
    equipe: snapshot.equipe,
    medico: snapshot.medico,
  };

  const pdf = await renderToBuffer(DocumentoAlta({ folha }));
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: cabecalhos({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="folha-alta-${id.slice(0, 8)}.pdf"`,
    }),
  });
}
