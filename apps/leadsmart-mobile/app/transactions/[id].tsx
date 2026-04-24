import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BrandRefreshControl } from "../../components/BrandRefreshControl";
import { ErrorBanner } from "../../components/ErrorBanner";
import { FadeIn } from "../../components/Reveal";
import { ScreenLoading } from "../../components/ScreenLoading";
import {
  addMobileTransactionTask,
  deleteMobileTransactionTask,
  fetchMobileTransactionDetail,
  updateMobileTransaction,
  updateMobileTransactionTask,
  type MobileApiFailure,
  type MobileTransactionCounterpartyRow,
  type MobileTransactionDetail,
  type MobileTransactionRow,
  type MobileTransactionStage,
  type MobileTransactionStatus,
  type MobileTransactionTaskRow,
} from "../../lib/leadsmartMobileApi";
import { useCachedFetch } from "../../lib/offline/useCachedFetch";
import {
  hapticButtonPress,
  hapticDestructive,
  hapticError,
  hapticSelectionChange,
  hapticSuccess,
} from "../../lib/haptics";
import { useThemeTokens } from "../../lib/useThemeTokens";
import type { ThemeTokens } from "../../lib/theme";

const STAGE_ORDER: Array<{ value: MobileTransactionStage; label: string }> = [
  { value: "contract", label: "Contract" },
  { value: "inspection", label: "Inspection" },
  { value: "appraisal", label: "Appraisal" },
  { value: "loan", label: "Loan" },
  { value: "closing", label: "Closing" },
];

const STATUS_FLOW: Array<{ value: MobileTransactionStatus; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
  { value: "terminated", label: "Terminated" },
];

/**
 * Transaction detail. Designed for an agent juggling a deal who
 * needs to:
 *
 *  1. See the progress bar across stages — how far along is this deal.
 *  2. Tick off tasks by stage (seeded + custom). Long-press to delete
 *     custom tasks.
 *  3. Track key deadlines (inspection / appraisal / loan / closing)
 *     and quick-mark "completed" toggles.
 *  4. Read the list of counterparties (title, lender, inspector, etc.)
 *     and one-tap call/email — agents are constantly toggling between
 *     these contacts during a deal.
 *  5. Flip the deal status (active → closed) which triggers the
 *     server-side commission backfill.
 *
 * Add task / counterparty CRUD beyond add-task lives on web — the
 * service-side seed flow already gives a usable starting checklist
 * the moment a transaction is created (or converted from an offer).
 */
export default function TransactionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const transactionId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";

  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const fetcher = useCallback(async (): Promise<MobileTransactionDetail | MobileApiFailure> => {
    if (!transactionId) {
      return { ok: false, status: 0, message: "Missing transaction id." };
    }
    const res = await fetchMobileTransactionDetail(transactionId);
    if (res.ok === false) return res;
    return {
      transaction: res.transaction,
      tasks: res.tasks,
      counterparties: res.counterparties,
      contactName: res.contactName,
    };
  }, [transactionId]);

  const { data, loading, error, refresh } = useCachedFetch<MobileTransactionDetail>(
    `transaction:${transactionId}`,
    fetcher,
    { enabled: Boolean(transactionId) },
  );

  const [transaction, setTransaction] = useState<MobileTransactionRow | null>(null);
  const [tasks, setTasks] = useState<MobileTransactionTaskRow[]>([]);
  const [counterparties, setCounterparties] = useState<MobileTransactionCounterpartyRow[]>([]);
  const [contactName, setContactName] = useState<string | null>(null);

  const [statusBusy, setStatusBusy] = useState<MobileTransactionStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [taskBusy, setTaskBusy] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);

  const [addStage, setAddStage] = useState<MobileTransactionStage>("contract");
  const [addTitle, setAddTitle] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [notesSavedAt, setNotesSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!data) return;
    setTransaction(data.transaction);
    setTasks(data.tasks);
    setCounterparties(data.counterparties);
    setContactName(data.contactName);
    setNotes(data.transaction.notes ?? "");
  }, [data]);

  // Tasks grouped by stage in canonical order — seeded tasks have a
  // stable order_index, custom appended after.
  const tasksByStage = useMemo(() => {
    const buckets: Record<MobileTransactionStage, MobileTransactionTaskRow[]> = {
      contract: [],
      inspection: [],
      appraisal: [],
      loan: [],
      closing: [],
    };
    for (const t of tasks) {
      buckets[t.stage].push(t);
    }
    for (const k of Object.keys(buckets) as MobileTransactionStage[]) {
      buckets[k].sort((a, b) => a.order_index - b.order_index);
    }
    return buckets;
  }, [tasks]);

  const totals = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.completed_at != null).length;
    const overdue = tasks.filter(
      (t) => t.completed_at == null && t.due_date && new Date(t.due_date).getTime() < Date.now(),
    ).length;
    return { total, done, overdue };
  }, [tasks]);

  const onPickStatus = useCallback(
    async (next: MobileTransactionStatus) => {
      if (!transaction || statusBusy || transaction.status === next) return;
      // Closing or terminating is a meaningful step — confirm so a
      // misclick on a small chip doesn't silently flip a live deal.
      const needsConfirm = next === "closed" || next === "terminated";
      const doIt = async () => {
        hapticSelectionChange();
        setStatusError(null);
        setStatusBusy(next);
        const res = await updateMobileTransaction(transaction.id, { status: next });
        setStatusBusy(null);
        if (res.ok === false) {
          hapticError();
          setStatusError(res.message);
          return;
        }
        hapticSuccess();
        setTransaction(res.transaction);
      };
      if (needsConfirm) {
        Alert.alert(
          next === "closed" ? "Mark as closed?" : "Terminate transaction?",
          next === "closed"
            ? "This stamps the closing date and runs the commission calculation. You can still edit the deal afterward."
            : "Marks the deal as terminated. Use this when a contract falls through.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: next === "closed" ? "Mark closed" : "Terminate",
              style: next === "closed" ? "default" : "destructive",
              onPress: () => void doIt(),
            },
          ],
        );
      } else {
        await doIt();
      }
    },
    [transaction, statusBusy],
  );

  const onToggleTask = useCallback(
    async (task: MobileTransactionTaskRow) => {
      if (!transaction || taskBusy === task.id) return;
      hapticSelectionChange();
      setTaskError(null);
      setTaskBusy(task.id);
      const completed = task.completed_at == null; // toggling on
      const res = await updateMobileTransactionTask(transaction.id, task.id, { completed });
      setTaskBusy(null);
      if (res.ok === false) {
        hapticError();
        setTaskError(res.message);
        return;
      }
      if (completed) hapticSuccess();
      setTasks((prev) => prev.map((t) => (t.id === task.id ? res.task : t)));
    },
    [transaction, taskBusy],
  );

  const onDeleteTask = useCallback(
    (task: MobileTransactionTaskRow) => {
      if (!transaction) return;
      if (task.source !== "custom") return; // seeded tasks aren't deletable
      Alert.alert("Delete task?", `Remove "${task.title}" from this deal?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            hapticDestructive();
            const res = await deleteMobileTransactionTask(transaction.id, task.id);
            if (res.ok === false) {
              hapticError();
              setTaskError(res.message);
              return;
            }
            hapticSuccess();
            setTasks((prev) => prev.filter((t) => t.id !== task.id));
          },
        },
      ]);
    },
    [transaction],
  );

  const onAddTask = useCallback(async () => {
    if (!transaction) return;
    if (!addTitle.trim()) {
      setAddError("Task title is required.");
      return;
    }
    hapticButtonPress();
    setAddError(null);
    setAddBusy(true);
    const res = await addMobileTransactionTask(transaction.id, {
      stage: addStage,
      title: addTitle.trim(),
    });
    setAddBusy(false);
    if (res.ok === false) {
      hapticError();
      setAddError(res.message);
      return;
    }
    hapticSuccess();
    setTasks((prev) => [...prev, res.task]);
    setAddTitle("");
  }, [transaction, addStage, addTitle]);

  const onSaveNotes = useCallback(async () => {
    if (!transaction) return;
    hapticButtonPress();
    setNotesError(null);
    setNotesSaving(true);
    const res = await updateMobileTransaction(transaction.id, { notes: notes.trim() });
    setNotesSaving(false);
    if (res.ok === false) {
      hapticError();
      setNotesError(res.message);
      return;
    }
    hapticSuccess();
    setTransaction(res.transaction);
    setNotesSavedAt(Date.now());
  }, [transaction, notes]);

  const onMarkDeadline = useCallback(
    async (
      field: "inspection_completed_at" | "appraisal_completed_at" | "loan_contingency_removed_at",
    ) => {
      if (!transaction) return;
      hapticSelectionChange();
      const current = transaction[field];
      const next = current ? null : new Date().toISOString();
      const res = await updateMobileTransaction(transaction.id, { [field]: next });
      if (res.ok === false) {
        hapticError();
        setStatusError(res.message);
        return;
      }
      hapticSuccess();
      setTransaction(res.transaction);
    },
    [transaction],
  );

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/transactions");
  }, [router]);

  if (loading && !transaction) {
    return <ScreenLoading message="Loading transaction…" />;
  }

  if (error && !transaction) {
    return (
      <View style={styles.errorWrap}>
        <Stack.Screen options={{ title: "Transaction", headerBackTitle: "Back" }} />
        <ErrorBanner
          title="Could not load transaction"
          message={error.message || "Unknown error"}
          onRetry={refresh}
        />
      </View>
    );
  }

  if (!transaction) {
    return (
      <View style={styles.errorWrap}>
        <Stack.Screen options={{ title: "Transaction", headerBackTitle: "Back" }} />
        <ErrorBanner
          title="Transaction not found"
          message="This deal may have been deleted."
          onRetry={goBack}
          retryLabel="Back to list"
        />
      </View>
    );
  }

  const purchasePrice = formatMoney(transaction.purchase_price);
  const closingLine = transaction.closing_date_actual
    ? `Closed ${formatDate(transaction.closing_date_actual)}`
    : transaction.closing_date
      ? `Closing ${formatDate(transaction.closing_date)}`
      : "No closing date set";

  return (
    <KeyboardAvoidingView
      style={styles.kav}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <Stack.Screen options={{ title: "Transaction", headerBackTitle: "Back" }} />
      <FadeIn style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={<BrandRefreshControl refreshing={loading} onRefresh={refresh} />}
        >
          {/* Hero */}
          <View style={styles.hero}>
            <Text style={styles.address} numberOfLines={2}>
              {transaction.property_address}
            </Text>
            {transaction.city || transaction.state || transaction.zip ? (
              <Text style={styles.cityLine}>
                {[transaction.city, transaction.state, transaction.zip]
                  .filter(Boolean)
                  .join(", ")}
              </Text>
            ) : null}
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Purchase price</Text>
              <Text style={styles.priceValue}>{purchasePrice}</Text>
            </View>
            <Text style={styles.closingLine}>{closingLine}</Text>
            {contactName ? (
              <Text style={styles.contactLine}>Client: {contactName}</Text>
            ) : null}
            <Text style={styles.typeLine}>
              {transaction.transaction_type === "buyer_rep"
                ? "Buyer representation"
                : transaction.transaction_type === "listing_rep"
                  ? "Listing representation"
                  : "Dual representation"}
            </Text>
          </View>

          {/* Progress */}
          <View style={styles.progressBlock}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.sectionHeading}>Progress</Text>
              <Text style={styles.progressCount}>
                {totals.done}/{totals.total} tasks
                {totals.overdue > 0 ? `  ·  ${totals.overdue} overdue` : ""}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${totals.total > 0 ? (totals.done / totals.total) * 100 : 0}%` },
                ]}
              />
            </View>
          </View>

          {/* Status picker */}
          <Text style={styles.sectionHeading}>Status</Text>
          <View style={styles.statusGrid}>
            {STATUS_FLOW.map((opt) => {
              const active = transaction.status === opt.value;
              const busy = statusBusy === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => void onPickStatus(opt.value)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Mark as ${opt.label}`}
                  accessibilityState={{ selected: active, disabled: busy }}
                  style={({ pressed }) => [
                    styles.statusBtn,
                    active && styles.statusBtnActive,
                    pressed && styles.statusBtnPressed,
                  ]}
                >
                  <Text style={[styles.statusBtnText, active && styles.statusBtnTextActive]}>
                    {busy ? "Saving…" : opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {statusError ? <Text style={styles.inlineError}>{statusError}</Text> : null}

          {/* Deadlines */}
          <View style={styles.divider} />
          <Text style={styles.sectionHeading}>Deadlines</Text>
          <DeadlineRow
            label="Inspection"
            deadline={transaction.inspection_deadline}
            completedAt={transaction.inspection_completed_at}
            onToggle={() => void onMarkDeadline("inspection_completed_at")}
            styles={styles}
            tokens={tokens}
          />
          <DeadlineRow
            label="Appraisal"
            deadline={transaction.appraisal_deadline}
            completedAt={transaction.appraisal_completed_at}
            onToggle={() => void onMarkDeadline("appraisal_completed_at")}
            styles={styles}
            tokens={tokens}
          />
          <DeadlineRow
            label="Loan contingency"
            deadline={transaction.loan_contingency_deadline}
            completedAt={transaction.loan_contingency_removed_at}
            completedLabel="Removed"
            onToggle={() => void onMarkDeadline("loan_contingency_removed_at")}
            styles={styles}
            tokens={tokens}
          />

          {/* Tasks by stage */}
          <View style={styles.divider} />
          <Text style={styles.sectionHeading}>Checklist</Text>
          {taskError ? <Text style={styles.inlineError}>{taskError}</Text> : null}
          {STAGE_ORDER.map((stage) => {
            const items = tasksByStage[stage.value];
            if (items.length === 0) return null;
            return (
              <View key={stage.value} style={styles.stageBlock}>
                <Text style={styles.stageLabel}>{stage.label}</Text>
                {items.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    busy={taskBusy === task.id}
                    onToggle={() => void onToggleTask(task)}
                    onDelete={() => onDeleteTask(task)}
                    styles={styles}
                    tokens={tokens}
                  />
                ))}
              </View>
            );
          })}

          {/* Add custom task */}
          <Text style={styles.label}>Add a custom task</Text>
          <View style={styles.stageRow}>
            {STAGE_ORDER.map((s) => {
              const active = addStage === s.value;
              return (
                <Pressable
                  key={s.value}
                  onPress={() => {
                    hapticSelectionChange();
                    setAddStage(s.value);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.stageBtn,
                    active && styles.stageBtnActive,
                    pressed && styles.stageBtnPressed,
                  ]}
                >
                  <Text style={[styles.stageBtnText, active && styles.stageBtnTextActive]}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={addTitle}
            onChangeText={setAddTitle}
            placeholder="Task title (e.g. Wire instructions verified)"
            placeholderTextColor={tokens.textSubtle}
            style={styles.input}
          />
          {addError ? <Text style={styles.inlineError}>{addError}</Text> : null}
          <Pressable
            onPress={() => void onAddTask()}
            disabled={addBusy}
            accessibilityRole="button"
            accessibilityLabel="Add task"
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && styles.secondaryBtnPressed,
              addBusy && styles.secondaryBtnDisabled,
            ]}
          >
            <Text style={styles.secondaryBtnText}>{addBusy ? "Saving…" : "Add task"}</Text>
          </Pressable>

          {/* Counterparties */}
          {counterparties.length > 0 ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionHeading}>Counterparties</Text>
              {counterparties.map((cp) => (
                <CounterpartyCard key={cp.id} cp={cp} styles={styles} tokens={tokens} />
              ))}
            </>
          ) : null}

          {/* Notes */}
          <View style={styles.divider} />
          <Text style={styles.sectionHeading}>Notes</Text>
          <TextInput
            multiline
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything worth remembering — title-company quirks, lender deadlines, buyer concerns…"
            placeholderTextColor={tokens.textSubtle}
            style={styles.textArea}
          />
          {notesError ? <Text style={styles.inlineError}>{notesError}</Text> : null}
          {notesSavedAt && !notesError ? (
            <Text style={styles.inlineSaved}>Saved.</Text>
          ) : null}
          <Pressable
            onPress={() => void onSaveNotes()}
            disabled={notesSaving}
            accessibilityRole="button"
            accessibilityLabel="Save notes"
            style={({ pressed }) => [
              styles.saveBtn,
              pressed && styles.saveBtnPressed,
              notesSaving && styles.saveBtnDisabled,
            ]}
          >
            <Text style={styles.saveBtnText}>
              {notesSaving ? "Saving…" : "Save notes"}
            </Text>
          </Pressable>

          {/* Open client */}
          <Pressable
            onPress={() => {
              hapticButtonPress();
              router.push({ pathname: "/lead/[id]", params: { id: transaction.contact_id } });
            }}
            accessibilityRole="button"
            accessibilityLabel="Open client detail"
            style={({ pressed }) => [styles.linkBtn, pressed && styles.linkBtnPressed]}
          >
            <Ionicons name="person-outline" size={16} color={tokens.accent} />
            <Text style={styles.linkBtnText}>Open client</Text>
          </Pressable>
        </ScrollView>
      </FadeIn>
    </KeyboardAvoidingView>
  );
}

function DeadlineRow({
  label,
  deadline,
  completedAt,
  completedLabel = "Completed",
  onToggle,
  styles,
  tokens,
}: {
  label: string;
  deadline: string | null;
  completedAt: string | null;
  completedLabel?: string;
  onToggle: () => void;
  styles: ReturnType<typeof createStyles>;
  tokens: ThemeTokens;
}) {
  const isDone = Boolean(completedAt);
  const overdue = !isDone && deadline && new Date(deadline).getTime() < Date.now();
  return (
    <View style={styles.deadlineRow}>
      <View style={styles.deadlineCopy}>
        <Text style={styles.deadlineLabel}>{label}</Text>
        <Text
          style={[
            styles.deadlineMeta,
            overdue ? styles.deadlineMetaOverdue : null,
            isDone ? styles.deadlineMetaDone : null,
          ]}
        >
          {isDone
            ? `${completedLabel} ${formatDate(completedAt)}`
            : deadline
              ? `Due ${formatDate(deadline)}`
              : "No deadline set"}
        </Text>
      </View>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={isDone ? `Mark ${label} not completed` : `Mark ${label} completed`}
        accessibilityState={{ checked: isDone }}
        style={({ pressed }) => [
          styles.deadlineToggle,
          isDone && styles.deadlineToggleOn,
          pressed && styles.deadlineTogglePressed,
        ]}
      >
        {isDone ? (
          <Ionicons name="checkmark" size={16} color={tokens.textOnAccent} />
        ) : (
          <Ionicons name="ellipse-outline" size={16} color={tokens.textMuted} />
        )}
      </Pressable>
    </View>
  );
}

function TaskRow({
  task,
  busy,
  onToggle,
  onDelete,
  styles,
  tokens,
}: {
  task: MobileTransactionTaskRow;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
  styles: ReturnType<typeof createStyles>;
  tokens: ThemeTokens;
}) {
  const isDone = Boolean(task.completed_at);
  const overdue =
    !isDone && task.due_date && new Date(task.due_date).getTime() < Date.now();

  return (
    <Pressable
      onPress={onToggle}
      onLongPress={task.source === "custom" ? onDelete : undefined}
      disabled={busy}
      accessibilityRole="checkbox"
      accessibilityLabel={task.title}
      accessibilityState={{ checked: isDone, disabled: busy }}
      accessibilityHint={task.source === "custom" ? "Long-press to delete" : undefined}
      style={({ pressed }) => [styles.taskRow, pressed && styles.taskRowPressed]}
    >
      <View style={[styles.taskCheckbox, isDone && styles.taskCheckboxOn]}>
        {isDone ? <Ionicons name="checkmark" size={14} color={tokens.textOnAccent} /> : null}
      </View>
      <View style={styles.taskCopy}>
        <Text style={[styles.taskTitle, isDone && styles.taskTitleDone]} numberOfLines={2}>
          {task.title}
        </Text>
        {task.due_date ? (
          <Text
            style={[
              styles.taskMeta,
              overdue && !isDone ? styles.taskMetaOverdue : null,
              isDone ? styles.taskMetaDone : null,
            ]}
          >
            {isDone ? "Done" : `Due ${formatDate(task.due_date)}`}
          </Text>
        ) : null}
      </View>
      {task.source === "custom" ? (
        <Ionicons name="ellipsis-horizontal" size={14} color={tokens.textSubtle} />
      ) : null}
    </Pressable>
  );
}

function CounterpartyCard({
  cp,
  styles,
  tokens,
}: {
  cp: MobileTransactionCounterpartyRow;
  styles: ReturnType<typeof createStyles>;
  tokens: ThemeTokens;
}) {
  const roleLabel = cp.role.replace(/_/g, " ");
  return (
    <View style={styles.counterpartyCard}>
      <View style={styles.counterpartyHeader}>
        <Text style={styles.counterpartyName} numberOfLines={1}>
          {cp.name}
        </Text>
        <Text style={styles.counterpartyRole}>{roleLabel}</Text>
      </View>
      {cp.company ? (
        <Text style={styles.counterpartyCompany} numberOfLines={1}>
          {cp.company}
        </Text>
      ) : null}
      <View style={styles.counterpartyActions}>
        {cp.phone ? (
          <Pressable
            onPress={() => {
              hapticButtonPress();
              void Linking.openURL(`tel:${cp.phone}`);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Call ${cp.name}`}
            style={({ pressed }) => [styles.cpActionBtn, pressed && styles.cpActionBtnPressed]}
          >
            <Ionicons name="call-outline" size={14} color={tokens.accent} />
            <Text style={styles.cpActionText}>Call</Text>
          </Pressable>
        ) : null}
        {cp.email ? (
          <Pressable
            onPress={() => {
              hapticButtonPress();
              void Linking.openURL(`mailto:${cp.email}`);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Email ${cp.name}`}
            style={({ pressed }) => [styles.cpActionBtn, pressed && styles.cpActionBtnPressed]}
          >
            <Ionicons name="mail-outline" size={14} color={tokens.accent} />
            <Text style={styles.cpActionText}>Email</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function formatMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function createStyles(t: ThemeTokens) {
  return StyleSheet.create({
    flex: { flex: 1 },
    kav: { flex: 1, backgroundColor: t.bg },
    scrollContent: { padding: 16, paddingBottom: 48 },
    errorWrap: { flex: 1, backgroundColor: t.bg, padding: 16, justifyContent: "flex-start" },

    hero: {
      backgroundColor: t.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: t.border,
      marginBottom: 16,
    },
    address: { fontSize: 18, fontWeight: "700", color: t.text },
    cityLine: { marginTop: 4, fontSize: 13, color: t.textMuted },
    priceRow: {
      marginTop: 12,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
    },
    priceLabel: { fontSize: 12, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, fontWeight: "600" },
    priceValue: { fontSize: 22, fontWeight: "700", color: t.text, fontVariant: ["tabular-nums"] },
    closingLine: { marginTop: 6, fontSize: 13, color: t.textMuted },
    contactLine: { marginTop: 4, fontSize: 13, color: t.textMuted },
    typeLine: { marginTop: 4, fontSize: 12, color: t.textSubtle },

    progressBlock: { marginBottom: 16 },
    progressLabelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    progressCount: { fontSize: 12, color: t.textMuted, fontVariant: ["tabular-nums"] },
    progressTrack: { height: 6, borderRadius: 999, backgroundColor: t.surfaceMuted, overflow: "hidden" },
    progressFill: { height: "100%", backgroundColor: t.accent },

    sectionHeading: {
      fontSize: 12,
      fontWeight: "800",
      color: t.textMuted,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 8,
    },

    statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    statusBtn: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
      minHeight: 40,
      justifyContent: "center",
    },
    statusBtnActive: { backgroundColor: t.chipActiveBg, borderColor: t.chipActiveBorder },
    statusBtnPressed: { opacity: 0.85 },
    statusBtnText: { fontSize: 13, fontWeight: "600", color: t.text },
    statusBtnTextActive: { color: t.chipActiveText },

    inlineError: { marginTop: 8, fontSize: 13, color: t.dangerTitle },
    inlineSaved: { marginTop: 8, fontSize: 13, color: t.successTextDark },

    divider: { height: 1, backgroundColor: t.border, marginVertical: 24 },

    deadlineRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 8,
    },
    deadlineCopy: { flex: 1 },
    deadlineLabel: { fontSize: 14, fontWeight: "600", color: t.text },
    deadlineMeta: { marginTop: 2, fontSize: 12, color: t.textMuted },
    deadlineMetaOverdue: { color: t.dangerTitle, fontWeight: "600" },
    deadlineMetaDone: { color: t.successTextDark },
    deadlineToggle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: t.border,
      backgroundColor: t.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    deadlineToggleOn: { backgroundColor: t.successButton, borderColor: t.successButton },
    deadlineTogglePressed: { opacity: 0.85 },

    stageBlock: { marginBottom: 12 },
    stageLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: t.text,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 6,
    },

    taskRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 4,
    },
    taskRowPressed: { opacity: 0.7 },
    taskCheckbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: t.border,
      backgroundColor: t.surface,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
    },
    taskCheckboxOn: { backgroundColor: t.accent, borderColor: t.accent },
    taskCopy: { flex: 1 },
    taskTitle: { fontSize: 14, color: t.text },
    taskTitleDone: { color: t.textMuted, textDecorationLine: "line-through" },
    taskMeta: { marginTop: 2, fontSize: 11, color: t.textMuted },
    taskMetaOverdue: { color: t.dangerTitle, fontWeight: "600" },
    taskMetaDone: { color: t.successTextDark },

    label: {
      marginTop: 12,
      marginBottom: 6,
      fontSize: 13,
      fontWeight: "600",
      color: t.text,
    },

    stageRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    stageBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
    },
    stageBtnActive: { borderColor: t.accent, backgroundColor: t.accentPressed },
    stageBtnPressed: { opacity: 0.85 },
    stageBtnText: { fontSize: 12, fontWeight: "600", color: t.text },
    stageBtnTextActive: { color: t.accent },

    input: {
      marginTop: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
      fontSize: 14,
      color: t.text,
    },

    textArea: {
      minHeight: 80,
      textAlignVertical: "top",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
      padding: 12,
      fontSize: 14,
      color: t.text,
    },

    secondaryBtn: {
      marginTop: 12,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.accent,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
    },
    secondaryBtnPressed: { opacity: 0.85 },
    secondaryBtnDisabled: { opacity: 0.5 },
    secondaryBtnText: { fontSize: 14, fontWeight: "600", color: t.accent },

    counterpartyCard: {
      marginBottom: 8,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
    },
    counterpartyHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
    },
    counterpartyName: { flex: 1, fontSize: 14, fontWeight: "700", color: t.text },
    counterpartyRole: {
      fontSize: 11,
      fontWeight: "600",
      color: t.textMuted,
      textTransform: "capitalize",
    },
    counterpartyCompany: { marginTop: 2, fontSize: 12, color: t.textMuted },
    counterpartyActions: { marginTop: 8, flexDirection: "row", gap: 8 },
    cpActionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
    },
    cpActionBtnPressed: { opacity: 0.85 },
    cpActionText: { fontSize: 12, fontWeight: "600", color: t.accent },

    saveBtn: {
      marginTop: 12,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: t.accent,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
    },
    saveBtnPressed: { opacity: 0.85 },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText: { fontSize: 15, fontWeight: "700", color: t.textOnAccent },

    linkBtn: {
      marginTop: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
      minHeight: 44,
    },
    linkBtnPressed: { backgroundColor: t.surfaceMuted },
    linkBtnText: { fontSize: 13, fontWeight: "600", color: t.accent },
  });
}

