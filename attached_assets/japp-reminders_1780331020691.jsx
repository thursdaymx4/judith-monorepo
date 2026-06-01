/* japp-reminders.jsx — Judith's reminders: a lock-screen notification preview
   (with Pay now / Remind me tomorrow actions) plus the full reminder schedule. */

const MOM_ENDEARMENT = { PH: "Anak", ID: "Nak", VN: "Con", MY: "Sayang", TH: "Lûk", MX: "Mija", NG: "Dear", IN: "Beta" };

/* persona + country flavored notification copy for a given bill */
function reminderCopy(persona, bill, cur, code) {
  const amt = cur + Math.round(bill.amount).toLocaleString("en-US");
  const inDays = bill.dueDays <= 0 ? "due today" : bill.dueDays === 1 ? "due tomorrow" : "due in " + bill.dueDays + " days";
  const term = MOM_ENDEARMENT[code] || "Anak";
  switch (persona) {
    case "funny":
      return { title: "Heads up — " + bill.provider + " 👀", body: amt + " " + inDays + ". Let’s not gift them late-fee money, okay?" };
    case "sib":
      return { title: bill.provider + " again.", body: amt + ", " + inDays + ". Pay it before I have to remind you twice." };
    case "mama":
      return { title: term + ", " + bill.provider + " is " + inDays, body: amt + " na lang. Bayaran mo na para wala tayong problema, ha?" };
    default:
      return { title: bill.provider + " " + inDays, body: amt + " — a good time to clear it before it’s late." };
  }
}

function reminderDate(bill, leadDays) {
  /* due date is day-of-month in June 2026; reminder fires leadDays before */
  const d = Math.max(1, bill.dueDate - (leadDays || 3));
  return "Jun " + d;
}

function LockNotification({ ctx, bill }) {
  const { persona, markPaid, snooze } = ctx;
  const cur = (ctx.country && ctx.country.cur) || "₱";
  const code = ctx.country && ctx.country.code;
  const copy = bill
    ? reminderCopy(persona, bill, cur, code)
    : { title: "You’re all caught up", body: "Nothing due in the next few days. I’ll nudge you when something’s coming." };
  return (
    <div className="lockscreen">
      <div className="lock-time">
        <div className="lock-clock">9:41</div>
        <div className="lock-date">Monday, June 1</div>
      </div>
      <div className="lock-notif">
        <div className="lock-notif-head">
          <span className="lock-app-ico"><JudithAvatar persona={persona} size={26} state="idle" /></span>
          <span className="lock-app-name">JUDITH</span>
          <span className="lock-app-time">now</span>
        </div>
        <div className="lock-notif-title">{copy.title}</div>
        <div className="lock-notif-body">{copy.body}</div>
        {bill && (
          <div className="lock-actions">
            <button className="lock-act primary" onClick={() => markPaid(bill.id)}><Icon name="wallet" size={15} /> Pay now</button>
            <button className="lock-act" onClick={() => snooze(bill.id)}><Icon name="snooze" size={15} /> Remind tomorrow</button>
          </div>
        )}
      </div>
    </div>
  );
}

function RemindersTab({ ctx }) {
  const { bills, persona, toggles, openBill, goTab, due } = ctx;
  const list = (due || bills.filter((b) => b.status !== "paid")).slice().sort((a, b) => a.dueDays - b.dueDays);
  const hero = list[0] || null;
  const lead = 3; // days before — matches Settings default
  const remindersOn = !toggles || toggles.reminders !== false;

  /* group reminders by when Judith will nudge */
  const groups = [
    { label: "Sending soon", items: list.filter((b) => b.dueDays <= 3) },
    { label: "This week", items: list.filter((b) => b.dueDays > 3 && b.dueDays <= 7) },
    { label: "Later this month", items: list.filter((b) => b.dueDays > 7) }
  ].filter((g) => g.items.length);

  return (
    <div className="pagepad view-anim" style={{ paddingBottom: 24 }}>
      <h1 className="h" style={{ marginTop: 4, marginBottom: 4 }}>Reminders</h1>
      <p className="muted" style={{ fontSize: 14, marginTop: 0, marginBottom: 16 }}>Here’s how Judith will nudge you — and when.</p>

      <LockNotification ctx={ctx} bill={hero} />

      {!remindersOn && (
        <div className="card" style={{ marginTop: 16, display: "flex", gap: 11, alignItems: "center", borderColor: "color-mix(in oklab, var(--near) 40%, transparent)" }} onClick={() => goTab("settings")}>
          <span className="ico" style={{ color: "var(--near)" }}><Icon name="bell" size={17} /></span>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>Reminders are off</div><div className="low" style={{ fontSize: 12 }}>Turn them on in Settings so these can send.</div></div>
          <Icon name="chev" size={16} />
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "20px 0 6px" }}>
        <div className="section-label" style={{ margin: 0 }}>Scheduled</div>
        <span className="low" style={{ fontSize: 12 }}>{lead} days before · 9:00 AM</span>
      </div>

      {groups.map((g) => (
        <div key={g.label}>
          <div className="rem-grouplabel">{g.label}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 6 }}>
            {g.items.map((b) => (
              <div key={b.id} className="rem-row" onClick={() => openBill(b)}>
                <span className={"rem-line " + dueClass(b.dueDays)}></span>
                <ProviderLogo provider={b.provider} cat={b.cat} size={36} />
                <div className="meta" style={{ flex: 1, minWidth: 0 }}>
                  <div className="p">{b.provider}</div>
                  <div className="d"><Icon name="bell" size={11} /> Reminder {reminderDate(b, lead)} · 9:00 AM</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="mono amt" style={{ color: "var(--" + dueClass(b.dueDays) + ")" }}>{peso(b.amount)}</div>
                  <div className="low" style={{ fontSize: 10 }}>due {b.dueLabel}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {list.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "26px 16px" }}>
          <div style={{ fontWeight: 600 }}>No reminders scheduled</div>
          <div className="low" style={{ fontSize: 12, marginTop: 4 }}>You’re all caught up. Judith will set new ones as bills come due.</div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { RemindersTab, LockNotification, reminderCopy });
