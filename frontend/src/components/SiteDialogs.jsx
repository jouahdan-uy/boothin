import { IMPORTED_THEMES } from "../data/themes";
import { frames } from "../data/frames";
import { FILTERS } from "../engine/filters.js";
import Dialog from "./Dialog";
import MessageForm from "./MessageForm";

export function AboutDialog({ onClose }) {
  return (
    <Dialog title="about boothin'" onClose={onClose}>
      <p className="dialog-lead">a tiny booth for big little moments.</p>
      <p>
        boothin' is a digital photobooth that lives in your browser. Pick a frame, strike a pose, choose a
        background, add stickers and text, then save your little moment.
      </p>

      <h3>your photos stay yours</h3>
      <ul className="dialog-list">
        <li>The camera feed and your photos are processed on your own device while you shoot and edit.</li>
        <li>
          Only if you ask for a QR code or an email, the final picture is uploaded temporarily so it can be
          opened or attached. It is deleted automatically after a few hours.
        </li>
        <li>
          Messages from Contact and Feedback are sent to me by email and are not stored on the server.
        </li>
      </ul>

      <p className="dialog-credit">made with ♡ by zzuhdamn</p>
    </Dialog>
  );
}

export function HowToDialog({ onClose }) {
  const steps = [
    [
      "pick a frame",
      `${frames.length} layouts, from classic strips to hearts and polaroids. Choose a color or pattern now, or change it later.`,
    ],
    [
      "take your photos",
      `Allow the camera and press the shutter, there's a 5 second timer. ${FILTERS.length} filters are waiting. Tap ✕ to cancel a countdown.`,
    ],
    ["review", "Happy with them? Continue. Not quite? Tap any photo to retake just that one."],
    [
      "choose a background",
      `Pick from ${IMPORTED_THEMES.length} patterns, any color, or a two-color gradient. Make the border wider to show more of it.`,
    ],
    [
      "decorate & save",
      "Add stickers and text: drag to move, pull the pink dot to resize and rotate, or pinch with two fingers. Then download the JPG, scan the QR code, send it by email, or print it.",
    ],
  ];

  return (
    <Dialog title="how to use" onClose={onClose} wide>
      <ol className="steps">
        {steps.map(([title, text], index) => (
          <li key={title}>
            <span className="step-number" aria-hidden="true">
              {index + 1}
            </span>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="dialog-tips">
        <strong>good to know</strong>
        <ul className="dialog-list">
          <li>The camera only works on a secure page (https) or on localhost.</li>
          <li>Your session lives in the page: refreshing before you save starts over.</li>
        </ul>
      </div>
    </Dialog>
  );
}

export function ContactDialog({ onClose }) {
  return (
    <Dialog title="contact" onClose={onClose}>
      <MessageForm type="contact" onClose={onClose} />
    </Dialog>
  );
}

export function FeedbackDialog({ onClose }) {
  return (
    <Dialog title="feedback" onClose={onClose}>
      <MessageForm type="feedback" onClose={onClose} />
    </Dialog>
  );
}
