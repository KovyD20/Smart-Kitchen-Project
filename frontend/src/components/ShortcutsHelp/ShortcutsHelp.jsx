import Icon from "../Icon/Icon";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import "./ShortcutsHelp.css";

// The cheat sheet behind "?". The app can be driven with the four arrows, Enter
// and Escape alone, and a keyboard-only layer nobody can discover is half a
// feature -- this is the cheapest possible way to publish it.
//
// A row is { keys: [chord, ...], joiner?, label }, where a chord is the list of
// key caps pressed together: [["Ctrl", "K"]] is one chord, [["↑"], ["↓"]] is two
// keys that do the same thing.
const SECTIONS = [
  {
    title: "Mozgás a lapon",
    rows: [
      {
        keys: [["↑"], ["↓"], ["←"], ["→"]],
        label: "A fókusz a nyíl irányában legközelebbi elemre lép — bárhol a lapon",
      },
      { keys: [["Enter"]], label: "A fókuszált elem aktiválása" },
      {
        keys: [["Esc"]],
        label:
          "Egy lépés kifelé: mezőből ki, réteg bezárása, végül vissza a menüsávra",
      },
      { keys: [["Alt", "1"], ["Alt", "5"]], joiner: "…", label: "Fülváltás" },
      { keys: [["/"], ["Ctrl", "K"]], joiner: "vagy", label: "Keresés" },
      { keys: [["?"]], label: "Ez a súgó" },
    ],
  },
  {
    title: "Beviteli mezőben",
    rows: [
      { keys: [["←"], ["→"]], label: "A kurzor mozgatása a szövegben" },
      {
        keys: [["↑"], ["↓"]],
        label: "Egysoros mezőből tovább a következő elemre",
      },
      {
        keys: [["↑"], ["↓"]],
        label:
          "Szám-, legördülő és többsoros mezőben a mező saját működése (érték, sor)",
      },
      { keys: [["Esc"]], label: "Kilépés a mezőből" },
    ],
  },
  {
    title: "Listák (bevásárlólista, hűtő)",
    rows: [
      {
        keys: [["↑"], ["↓"]],
        label: "Mozgás a sorok között, kártyahatáron át is",
      },
      { keys: [["←"], ["→"]], label: "Mennyiség csökkentése / növelése" },
      { keys: [["Space"]], label: "„Megvéve” pipa (bevásárlólista)" },
      { keys: [["Enter"]], label: "Mennyiség szerkesztése" },
      {
        keys: [["Delete"]],
        label: "Törlés — a megerősítő kérdésre Enter a válasz",
      },
      {
        keys: [["←"], ["→"]],
        label: "Kategória-fejlécen: a kártya összecsukása / kibontása",
      },
    ],
  },
  {
    title: "Receptlista",
    rows: [
      { keys: [["↑"], ["↓"]], label: "Mozgás a receptek között" },
      { keys: [["Enter"]], label: "Recept megnyitása" },
      { keys: [["F"]], label: "Kedvenc ki/be" },
    ],
  },
  {
    title: "Recept-űrlap",
    rows: [
      { keys: [["Ctrl", "Enter"]], label: "Mentés bárhonnan az űrlapról" },
      { keys: [["Enter"]], label: "Az utolsó sorban: új sor" },
    ],
  },
  {
    title: "Főzés mód",
    rows: [
      { keys: [["←"], ["→"]], label: "Előző / következő lépés" },
      { keys: [["Esc"]], label: "Kilépés" },
    ],
  },
];

function Chord({ keys }) {
  return (
    <span className="shortcut-keys">
      {keys.map((key) => (
        <kbd key={key}>{key}</kbd>
      ))}
    </span>
  );
}

export default function ShortcutsHelp({ onClose }) {
  const trapRef = useFocusTrap(true, { onEscape: onClose });

  return (
    <div className="shortcuts-overlay" onClick={onClose}>
      <div
        ref={trapRef}
        className="shortcuts-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shortcuts-head">
          <span className="panel-title" id="shortcuts-title">
            Gyorsbillentyűk
          </span>
          <button
            type="button"
            className="icon-btn"
            aria-label="Súgó bezárása"
            onClick={onClose}
          >
            <Icon name="xmark" size={13} />
          </button>
        </header>

        <p className="shortcuts-intro">
          Az egész alkalmazás végigvihető a négy nyíllal, az Enterrel és az
          Esc-cel — egér és Tab nélkül is.
        </p>

        <div className="shortcuts-body">
          {SECTIONS.map((section) => (
            <section key={section.title} className="shortcuts-section">
              <h3 className="shortcuts-section-title">{section.title}</h3>
              {section.rows.map((row) => (
                <div key={row.label} className="shortcut-row">
                  <span className="shortcut-combo">
                    {row.keys.map((chord, i) => (
                      <span key={chord.join("+")} className="shortcut-chord">
                        {i > 0 && row.joiner && (
                          <span className="shortcut-joiner">{row.joiner}</span>
                        )}
                        <Chord keys={chord} />
                      </span>
                    ))}
                  </span>
                  <span className="shortcut-label">{row.label}</span>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
