import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth, googleProvider } from "../../firebase";
import LightPillar from "../Background/LightPillar";
import "./AuthPanel.css";

export default function AuthPanel() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err?.message || "Hiba történt");
    }
  };

  const handleGoogle = async () => {
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(err?.message || "Hiba történt");
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-bg">
        <LightPillar />
      </div>

      <div className="auth-brand">
        <div className="auth-brand-mark">R</div>
        <h1 className="auth-title">Recept Operációs Rendszer</h1>
      </div>

      <div className="auth-card">
        <h2>{isRegister ? "Regisztráció" : "Bejelentkezés"}</h2>

        <form onSubmit={handleSubmit} className="auth-form">
          <input
            className="field field-neutral"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="field field-neutral"
            type="password"
            placeholder="Jelszó"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="btn-pill btn-solid">
            {isRegister ? "Fiók létrehozása" : "Belépés"}
          </button>
        </form>

        <button
          type="button"
          className="btn-pill btn-outline"
          style={{ "--accent": "var(--blue)" }}
          onClick={handleGoogle}
        >
          Google bejelentkezés
        </button>

        {error && <div className="auth-error">{error}</div>}

        <button
          type="button"
          className="auth-toggle"
          onClick={() => setIsRegister((p) => !p)}
        >
          {isRegister ? "Van már fiókod? Lépj be" : "Nincs fiókod? Regisztrálj"}
        </button>
      </div>
    </div>
  );
}
