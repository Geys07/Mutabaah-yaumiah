import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = (name) => readFile(new URL("../" + name, import.meta.url), "utf8");

test("chat uses optimistic delivery without waiting for backend before displaying", async () => {
  const [applicant, admin, helper] = await Promise.all([
    read("src/pages/ForgotPassword.jsx"),
    read("src/pages/AdminRecoveryChats.jsx"),
    read("src/lib/recoveryRealtime.jsx"),
  ]);
  for (const screen of [applicant, admin]) {
    assert.match(screen,/createOptimisticMessage/);
    assert.match(screen,/queueMessage\(/);
    assert.match(screen,/setDraft\(""?\)/);
    assert.match(screen,/void transmit/);
    assert.match(screen,/client_id/);
    assert.match(screen,/Kirim Ulang/);
    assert.match(screen,/Receipt message=\{msg\}/);
  }
  assert.match(helper,/supabase\.channel\(topic\)/);
  assert.match(helper,/\.on\("broadcast", \{ event: "refresh" \}/);
  assert.match(helper,/supabase\.removeChannel\(channel\)/);
  assert.match(helper,/combineRecoveryMessages/);
  assert.match(helper,/serverClientIds\.has\(m\.client_id\)/);
  assert.match(helper,/crypto\.randomUUID\(\)/);
});

test("one, two, blue ticks follow server ack, delivery and read fields", async () => {
  const [ui,css] = await Promise.all([
    read("src/lib/recoveryRealtime.jsx"),
    read("src/styles/recovery-chat-receipts.css"),
  ]);
  assert.match(ui,/message\.local_state === "sending"/);
  assert.match(ui,/message\.local_state === "failed"/);
  assert.match(ui,/message\.read_at/);
  assert.match(ui,/message\.delivered_at/);
  assert.match(ui,/✓✓/);
  assert.match(css,/\.rc-receipt\.is-read \{color:#2585dd\}/);
  assert.match(css,/var\(--sa-muted/);
});

test("backend emits refresh-only opaque broadcasts and protects patient/guardian content", async () => {
  const [sql,backend] = await Promise.all([
    read("supabase/migrations/20261024225500_recovery_chat_realtime_receipts.sql"),
    read("supabase/functions/recovery-chat/index.ts"),
  ]);
  assert.match(sql,/realtime\.send\('\{"version":1\}'::jsonb,'refresh'/);
  assert.match(sql,/recovery-chat-' \|\| channel_key/);
  assert.match(sql,/recovery-chat-admin-' \|\| admin_key/);
  assert.match(sql,/ADD COLUMN IF NOT EXISTS realtime_key/);
  assert.match(sql,/recovery_chat_client_idempotency_idx/);
  assert.match(sql,/recovery_chat_admin_signal ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/REVOKE ALL ON public\.recovery_chat_admin_signal FROM PUBLIC,anon,authenticated/);
  assert.match(backend,/ticketByToken\(body\.token\)/);
  assert.match(backend,/authorizedAdmin\(req\)/);
  assert.match(backend,/realtime_topic:/);
  assert.match(backend,/client_id/);
  assert.match(backend,/error\.code === "23505"/);
  assert.match(backend,/background\(\(\) => sendPushToAdmins/);
  assert.match(backend,/background\(\(\) => sendPushToApplicant/);
  assert.match(backend,/delivered_at/);
  assert.match(backend,/read_at/);
});

test("Admin can hide only Admin-visible messages; user history remains and handled chats rank last", async () => {
  const [admin,backend] = await Promise.all([
    read("src/pages/AdminRecoveryChats.jsx"),
    read("supabase/functions/recovery-chat/index.ts"),
  ]);
  assert.match(admin,/action:"admin_delete_message"/);
  assert.match(admin,/Hapus pesan untuk Admin/);
  assert.match(admin,/\["used","rejected","revoked"\]/);
  assert.match(admin,/t\.unread > 0/);
  assert.match(backend,/deleted_for_admin_at/);
  assert.match(backend,/owner === "admin" && msg\.deleted_for_admin_at/);
  assert.match(backend,/if\(action==="admin_delete_message"\)return await deleteForAdmin/);
  assert.match(backend,/\["admin_list","admin_chat","admin_send","admin_review","admin_reissue","admin_delete_message"\]/);
});
