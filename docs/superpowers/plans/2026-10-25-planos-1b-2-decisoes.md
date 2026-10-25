# Planos 1b e 2 — Decisões tomadas durante a execução

Decisões do Claude em nome do usuário, na ordem, com custo se erradas quando registrado.

## Plano 1b
- Task 3 review: Approved but 1 Important (leito change lost on reload/close: no pending UI/beforeunload/toast). Ruling: fix in round 1 with toast top-center + no-op Salvar toast + investigate medico1 on ...0003 (spec: any médico may write any internação).
- Task 3: fix round 1/5 done (bd6016c; e2e 80 x2). Item 4 = test artifact. Ruling: round 2 for pre-hydration typing loss (disable inputs until mounted) — real risk on slow phones.
- Ruling: Plan 1b whole-branch review folded into Plan 2's final review (small plan, 3 tasks; same files) — cost if wrong: 1b issues found later.

## Plano 2
| 5 self | step 1 test text muddled (recepcao url) | Ruling: unit test urlAssinada with RLS-empty row → erro; e2e checks recepção has no Exames tab |
- Ruling (concern 1): Task 2 migration 0008 recreates descartar_rascunho to delete the draft's anexos rows first (objects removed by the app via Storage API before calling it).
- Ruling (concern 2, storage protect_delete): SQL must not delete storage.objects; finalizar only deletes unconfirmed anexo ROWS; orphan objects stay unreadable (read policy requires a visible row) — cleanup job deferred (Plan 4 ops). Cost if wrong: some storage bytes wasted.
- Ruling: carry to Task 2 migration 0008: confirmar_anexo locks evolução `for share`; finalizar rejects if any confirmed anexo lacks its object (`Um anexo confirmado está sem arquivo. Remova-o e envie de novo.`); descricao length cap 500.
- Ruling: Task 4 applies Task 3 minors in processar-arquivo.ts: explicit imageOrientation 'from-image'; white background before drawImage; Math.max(1, …) in dimensoesAlvo; pre-compression size check only for PDF (images checked after compression, input cap 60 MB to avoid memory blowup); canvas.width=0 after toBlob.
- Task 4 review: Needs fixes (3 Important e2e). Ruling: also fix minors 1 (chips scroll), 2 (block Descartar/Salvar during upload), 3 (check storage.remove data length), 9 (alignment). Deferred: signed URL 300s re-sign (Task 5 adds urlAssinada action — reuse for previews), TypeError breadth, radio arrow keys, orphan-on-double-failure test.
- Task 4: fix round 1/5 done (bd89a1d). Ruling: round 2 — already-missing objects must not block discard/remove.
- Ruling: Task 6 also adds registrar_acesso(internacao_id, 'ver_anexo') in urlAssinada (LGPD access log) and janela.opener = null in abrir-pdf.ts.
- Task 6: implementer DONE (86be41f; unit 66, e2e 110). Ruling: WebP not embedded accepted — app re-encodes all images to JPEG before upload; WebP only reachable via direct API. Review dispatched.
- Task 6 review: Needs fixes (thumbnail overflow; unbounded downloads + plain print blocked by thumbnail failure). Ruling: plain print → failed thumbnail shows 'Miniatura indisponível', no 500; anexos=1 → failure 500 before vias; concurrency 4; cap 80 MB of image bytes per request → 413 'Muitas imagens para imprimir de uma vez. Imprima menos evoluções por vez.'; fold minors 3,4.
- Ruling (#3): register vias AFTER rendering: predict via per id (existing key → its via; else count+1), render, then atomic registrar_impressoes; if returned via ≠ predicted, re-render that evolution with the real via before responding. Also cap anexos=1 at 10 evolutions per request (413 'Imprima no máximo 10 evoluções com imagens por vez.'). Cost if wrong: rare double render.
- Ruling (minors in wave): #6 deploy order in docs; #7 ver_anexo only when viewer/PDF opened (not thumbnails); #9 accept empty MIME when extension .pdf; HEIC → clear message suggesting camera JPEG/PDF; #10 beforeunload during upload. Deferred: #4 verifier job (Plan 4 ops), #5 two-tab race (verifier), #8 orphans (cleanup job).

## Pendências menores adiadas
- Task 2: minor (deferred): convênio free text (case/space variants become separate chips) → consider normalized convênio list (Plan 4 admin); listarConvenios extra round trip
- Task 3: minor (deferred): fieldset indentation; comment split; hold-static e2e unroute on failure; beforeunload/toast.error untested; dev-server "destination stream closed early" under load
- Task 2: minor (deferred): no test that confirmed row can't be deleted under app.finalizando; descartar doesn't assert storage intact / non-author denial
- Task 4: minor (deferred): e2e formatting; -mt-2 pixel hack; folder derivation w/o '/'; e2e depends on docker container name
- Task 5: minor (deferred): N+1 signed URL calls (batch createSignedUrls later); unit mock ignores .eq args
