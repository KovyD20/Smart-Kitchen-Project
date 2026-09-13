import { useEffect, useId, useRef, useState } from "react";
import { pantryImageUrl } from "../../lib/pantryImages";
import "./SuggestInput.css";

// One suggestion row. A <div role="option"> rather than a button: an ARIA option
// must not contain an interactive element, and it does not need to be focusable
// -- the input keeps the caret and points at the active row with
// aria-activedescendant, which is what a combobox is supposed to do.
//
// The thumbnail is the same opportunistic one the list rows use: a conventional
// path, and a load failure simply drops the image.
function SuggestOption({ id, match, active, onPick }) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const { entry, alias } = match;
  const thumbSrc = pantryImageUrl({ nameKey: entry.key, imageUrl: entry.imageUrl });

  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      className={`suggest-option${active ? " is-active" : ""}`}
      // Without this the field blurs before the click lands, the list unmounts,
      // and the tap hits nothing. Preventing the default on mousedown keeps the
      // caret where it is and lets the click through -- on a phone too, where
      // the tap still produces this event.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onPick(match)}
    >
      {thumbSrc && !thumbFailed && (
        <img
          className="suggest-thumb"
          src={thumbSrc}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          onError={() => setThumbFailed(true)}
        />
      )}
      <span className="suggest-name">{entry.name}</span>
      {/* Why this row is here at all when the typed text is nowhere in its name:
          "krumpli" reaches burgonya through an alias, and without showing the
          alias the match looks like a bug. Aliases are stored folded (the
          backend normalizes them), so this is a lookup spelling, not prose. */}
      {alias && <span className="suggest-alias">{alias}</span>}
      <span className="suggest-cat">{entry.category}</span>
    </div>
  );
}

// A text field that offers matching pantry items while it is being typed into --
// type "ke", get kefir / kenyér / natúr kefir, pick one with the arrows and
// Enter, or with a tap.
//
// The field stays a plain controlled input: the parent owns `value`, and picking
// a suggestion is reported through `onSelect` with the catalog entry, so the
// caller can fill in more than the name (the add-item row also takes the package
// size from it). Without `suggest` it degrades to exactly that plain input,
// which is what keeps it safe to drop into views whose tests render no catalog.
//
// Enter is deliberately two-step: it only picks while a row is highlighted, and
// otherwise falls through to the caller's own handler, so a name that is not in
// the catalog is still added by typing it and pressing Enter once.
export default function SuggestInput({
  value,
  onChange,
  onSelect,
  suggest,
  dropUp = false,
  className = "",
  placeholder,
  onKeyDown,
  ...inputProps
}) {
  const [open, setOpen] = useState(false);
  // -1 = nothing highlighted, which is the state Enter must not steal. The first
  // ArrowDown is what arms the list.
  const [active, setActive] = useState(-1);
  const listRef = useRef(null);
  const listId = useId();
  const optionId = (index) => `${listId}-${index}`;

  // Recomputed every render rather than memoised: the query changes with every
  // keystroke, so a memo over it would be a cache of exactly one entry. The
  // search is a scan of a few hundred short strings.
  const matches = suggest ? suggest(value) : [];
  const isOpen = open && matches.length > 0;
  const activeMatch = active >= 0 ? matches[active] : null;

  // Keeps a highlight reached by arrow key inside the scrolled list. jsdom has
  // no scrollIntoView, hence the optional call rather than a guard.
  useEffect(() => {
    if (active < 0) return;
    listRef.current?.children[active]?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  // The panel is wider than the field it hangs off, and the desktop add row
  // lives at the right-hand end of a wrapping header — so near the edge of a
  // narrow window it would run off screen. Measured rather than guessed in CSS:
  // where it ends up depends on how the header happened to wrap.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    // Back to the stylesheet's position first, or a previous nudge would be
    // measured as if it were the natural one.
    list.style.left = "";
    const overflow = list.getBoundingClientRect().right - window.innerWidth + 12;
    if (overflow > 0) {
      list.style.left = `${-6 - overflow}px`;
    }
  }, [isOpen, value]);

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const pick = (match) => {
    close();
    onSelect?.(match.entry);
  };

  const move = (delta) => {
    if (!matches.length) return;
    setOpen(true);
    setActive((prev) => {
      const next = prev + delta;
      // Wrapping rather than stopping: the list is at most eight rows, so
      // running off one end and arriving at the other is quicker than reversing.
      if (next < 0) return matches.length - 1;
      if (next >= matches.length) return 0;
      return next;
    });
  };

  const handleKeyDown = (event) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
      case "Enter":
        // Nothing highlighted means the user typed a name and meant it: leave
        // the key to the caller, which submits the row.
        if (!activeMatch) break;
        event.preventDefault();
        pick(activeMatch);
        break;
      case "Escape":
        // Only while the list is up. Escape is the app's "close the topmost
        // layer" key, and swallowing it with nothing open would strand the
        // layer above (see useGlobalKeys, which checks defaultPrevented).
        if (!isOpen) break;
        event.preventDefault();
        close();
        break;
      case "Tab":
        // Not prevented: Tab moves on, it just must not leave a list behind.
        close();
        break;
      default:
        break;
    }
  };

  return (
    <div className={`suggest${dropUp ? " is-up" : ""}`}>
      <input
        {...inputProps}
        type="text"
        className={className}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeMatch ? optionId(active) : undefined}
        // The browser's own history dropdown would cover this one.
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event);
          setOpen(true);
          // Every keystroke changes the list under the highlight, so the
          // highlight cannot survive it -- and Enter goes back to submitting.
          setActive(-1);
        }}
        onBlur={close}
        onKeyDown={(event) => {
          handleKeyDown(event);
          // The caller's handler runs only for keys this one left alone, so the
          // Enter that picks a suggestion does not also add the row.
          if (!event.defaultPrevented) onKeyDown?.(event);
        }}
      />

      {isOpen && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Javaslatok"
          className="suggest-list"
        >
          {matches.map((match, index) => (
            <SuggestOption
              key={match.entry.key}
              id={optionId(index)}
              match={match}
              active={index === active}
              onPick={pick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
