import { useEffect, useId, useRef, useState } from "react";

import { sendMessage } from "../api.js";
import { MAX_MESSAGE, MAX_NAME, validateMessageForm } from "../lib/messageRules.js";

const COPY = {
  contact: {
    intro: "Got a question, an idea, or just want to say hi? Send it over and I'll get back to you.",
    emailLabel: "YOUR EMAIL",
    emailHint: "so I can reply",
    messagePlaceholder: "write your message here...",
    submit: "send message",
    thanksTitle: "message sent!",
    thanksText: "Thank you. I'll reply to your email when I can.",
  },
  feedback: {
    intro: "How was your booth experience? Tell me what you loved and what could be better.",
    emailLabel: "YOUR EMAIL",
    emailHint: "optional, only if you want a reply",
    messagePlaceholder: "what did you like? what should I improve?",
    submit: "send feedback",
    thanksTitle: "thank you!",
    thanksText: "Your feedback really helps make boothin' better.",
  },
};

function Stars({ id, value, onChange, invalid, describedBy }) {
  const refs = useRef([]);

  function onKeyDown(event, n) {
    let next = null;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = Math.min(5, (value || 0) + 1);
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = Math.max(1, (value || 2) - 1);
    if (next === null) return;
    event.preventDefault();
    onChange(next);
    refs.current[next - 1]?.focus();
    return n;
  }

  return (
    <div
      id={id}
      className={`stars${invalid ? " invalid" : ""}`}
      role="radiogroup"
      aria-label="Rating"
      aria-describedby={describedBy}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          ref={(el) => {
            refs.current[n - 1] = el;
          }}
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
          // roving tabindex: satu bintang saja yang bisa di-Tab
          tabIndex={value === n || (!value && n === 1) ? 0 : -1}
          className={n <= value ? "star on" : "star"}
          onClick={() => onChange(n)}
          onKeyDown={(event) => onKeyDown(event, n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/** Form Contact / Feedback. Dikirim lewat backend; pesan tidak disimpan di server. */
export default function MessageForm({ type, onClose }) {
  const copy = COPY[type];
  const uid = useId();
  const id = (name) => `${uid}-${name}`;

  const [values, setValues] = useState({ name: "", email: "", message: "", rating: 0 });
  const [website, setWebsite] = useState(""); // honeypot
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle | sending | sent
  const [serverError, setServerError] = useState("");

  const fieldRefs = useRef({});
  const doneRef = useRef(null);

  useEffect(() => {
    if (status === "sent") doneRef.current?.focus();
  }, [status]);

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors(({ [field]: _removed, ...rest }) => rest);
    setServerError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (status === "sending") return;

    const result = validateMessageForm(type, values);
    setErrors(result.errors);
    setServerError("");

    if (!result.ok) {
      const firstInvalid = ["rating", "name", "email", "message"].find((field) => result.errors[field]);
      if (firstInvalid === "rating") {
        // bintang yang sedang bisa di-Tab (roving tabindex)
        document.getElementById(id("rating"))?.querySelector('[tabindex="0"]')?.focus();
      } else {
        fieldRefs.current[firstInvalid]?.focus();
      }
      return;
    }

    setStatus("sending");
    try {
      await sendMessage({
        type,
        name: values.name.trim(),
        email: values.email.trim(),
        message: values.message.trim(),
        rating: type === "feedback" ? values.rating : undefined,
        website,
      });
      setStatus("sent");
    } catch (error) {
      setStatus("idle");
      setServerError(error?.message ?? "Pesan gagal dikirim. Coba lagi.");
    }
  }

  if (status === "sent") {
    return (
      <div className="form-done" role="status">
        <span className="form-done-mark" aria-hidden="true">
          ♡
        </span>
        <h3 ref={doneRef} tabIndex={-1}>
          {copy.thanksTitle}
        </h3>
        <p>{copy.thanksText}</p>
        <button type="button" className="panel-button" onClick={onClose}>
          close
        </button>
      </div>
    );
  }

  const sending = status === "sending";

  return (
    <form className="message-form" onSubmit={handleSubmit} noValidate>
      <p className="form-intro">{copy.intro}</p>

      {type === "feedback" && (
        <div className="form-field">
          <span className="field-label" id={id("rating-label")}>
            RATING
          </span>
          <Stars
            id={id("rating")}
            value={values.rating}
            onChange={(n) => update("rating", n)}
            invalid={Boolean(errors.rating)}
            describedBy={errors.rating ? id("rating-error") : undefined}
          />
          {errors.rating && (
            <p className="field-error" id={id("rating-error")} role="alert">
              {errors.rating}
            </p>
          )}
        </div>
      )}

      <div className="form-field">
        <label className="field-label" htmlFor={id("name")}>
          NAME <em>optional</em>
        </label>
        <input
          id={id("name")}
          ref={(el) => {
            fieldRefs.current.name = el;
          }}
          type="text"
          autoComplete="name"
          maxLength={MAX_NAME + 20}
          value={values.name}
          disabled={sending}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? id("name-error") : undefined}
          onChange={(event) => update("name", event.target.value)}
        />
        {errors.name && (
          <p className="field-error" id={id("name-error")} role="alert">
            {errors.name}
          </p>
        )}
      </div>

      <div className="form-field">
        <label className="field-label" htmlFor={id("email")}>
          {copy.emailLabel} <em>{copy.emailHint}</em>
        </label>
        <input
          id={id("email")}
          ref={(el) => {
            fieldRefs.current.email = el;
          }}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={values.email}
          disabled={sending}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? id("email-error") : undefined}
          onChange={(event) => update("email", event.target.value)}
        />
        {errors.email && (
          <p className="field-error" id={id("email-error")} role="alert">
            {errors.email}
          </p>
        )}
      </div>

      <div className="form-field">
        <label className="field-label" htmlFor={id("message")}>
          MESSAGE
        </label>
        <textarea
          id={id("message")}
          ref={(el) => {
            fieldRefs.current.message = el;
          }}
          rows={5}
          maxLength={MAX_MESSAGE}
          placeholder={copy.messagePlaceholder}
          value={values.message}
          disabled={sending}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? id("message-error") : undefined}
          onChange={(event) => update("message", event.target.value)}
        />
        <div className="field-meta">
          {errors.message ? (
            <p className="field-error" id={id("message-error")} role="alert">
              {errors.message}
            </p>
          ) : (
            <span />
          )}
          <span className="char-count">
            {values.message.length}/{MAX_MESSAGE}
          </span>
        </div>
      </div>

      {/* Kolom jebakan bot: tidak terlihat & tidak bisa di-Tab oleh manusia. */}
      <div className="hp-field" aria-hidden="true">
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </label>
      </div>

      {serverError && (
        <p className="form-error" role="alert">
          {serverError}
        </p>
      )}

      <button type="submit" className="start-button form-submit" disabled={sending}>
        {sending ? "sending..." : copy.submit}
        <span>→</span>
      </button>
    </form>
  );
}
