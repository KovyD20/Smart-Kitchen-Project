import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth, googleProvider } from "../../firebase";
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
      <div className="auth-card">
        <h2>{isRegister ? "Regisztráció" : "Bejelentkezés"}</h2>

        <form onSubmit={handleSubmit} className="auth-form">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Jelszó"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit">
            {isRegister ? "Fiók létrehozása" : "Belépés"}
          </button>
        </form>

        <button className="auth-google" onClick={handleGoogle}>
          Google bejelentkezés
        </button>

        {error && <div className="auth-error">{error}</div>}

        <button
          className="auth-toggle"
          onClick={() => setIsRegister((p) => !p)}
        >
          {isRegister ? "Van már fiókod? Lépj be" : "Nincs fiókod? Regisztrálj"}
        </button>
      </div>
    </div>
  );
}
