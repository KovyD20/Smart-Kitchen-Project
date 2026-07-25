import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import Home from "./pages/Home";
import AuthPanel from "./components/AuthPanel/AuthPanel";
import { CatalogProvider } from "./context/CatalogContext";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) return null;
  if (!user) return <AuthPanel />;

  return (
    <CatalogProvider>
      <Home user={user} />
    </CatalogProvider>
  );
}
