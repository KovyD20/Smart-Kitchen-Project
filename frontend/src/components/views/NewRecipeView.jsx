import Icon from "../Icon/Icon";
import AiRecipePanel from "../AiRecipePanel/AiRecipePanel";

// "Új recept" — pick a route in: type it yourself, or let the AI draft it.
export default function NewRecipeView({
  fridge,
  isMobile,
  onStartManual,
  onSaveAiRecipe,
}) {
  return (
    <div className="new-view">
      <div className="new-wrap">
        <div className="new-title">Hogyan kerüljön be az új recept?</div>

        <div className="new-cards">
          <button
            type="button"
            className="new-card"
            style={{ "--accent": "var(--brand)" }}
            onClick={onStartManual}
          >
            <span className="new-card-icon">
              <Icon name="pen" size={isMobile ? 15 : 17} />
            </span>
            <span className="new-card-manual-text">
              <span className="new-card-title">Új saját recept</span>
              <span className="new-card-text">
                {isMobile
                  ? "Kézzel viszed fel a hozzávalókat"
                  : "Kézzel viszed fel a nevet, a hozzávalókat és a lépéseket."}
              </span>
            </span>
            {isMobile ? (
              <Icon name="chevronRight" size={12} color="#6a6a6a" />
            ) : (
              <span className="new-card-cta">Létrehozás</span>
            )}
          </button>

          <div className="new-or">vagy</div>

          <AiRecipePanel
            fridgeItems={fridge}
            isMobile={isMobile}
            onSaveRecipe={onSaveAiRecipe}
          />
        </div>
      </div>
    </div>
  );
}
