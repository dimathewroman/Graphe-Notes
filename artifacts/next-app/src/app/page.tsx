"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import Home from "@/components/Home";
import { Mail, Loader2 } from "lucide-react";
import { DEMO_NOTES, DEMO_FOLDERS, DEMO_TAGS, DEMO_QUICK_BITS } from "@/lib/demo-data";
import { DemoContext } from "@/App";

const grapheLogo = "/graphe_minimalist_1773640203523.png";

function enterDemoMode(
  queryClient: ReturnType<typeof useQueryClient>,
  setIsDemo: (v: boolean) => void,
) {
  const demoInfinite = { staleTime: Infinity, gcTime: Infinity };
  queryClient.setQueryDefaults(["/api/folders"], demoInfinite);
  queryClient.setQueryDefaults(["/api/tags"], demoInfinite);
  queryClient.setQueryDefaults(["/api/vault/status"], demoInfinite);
  queryClient.setQueryDefaults(["/api/quick-bits"], demoInfinite);
  DEMO_NOTES.forEach((note) => {
    queryClient.setQueryDefaults([`/api/notes/${note.id}`], demoInfinite);
  });
  DEMO_QUICK_BITS.forEach((qb) => {
    queryClient.setQueryDefaults([`/api/quick-bits/${qb.id}`], demoInfinite);
  });

  queryClient.setQueryData(["/api/folders"], DEMO_FOLDERS);
  queryClient.setQueryData(["/api/tags"], DEMO_TAGS);
  queryClient.setQueryData(["/api/vault/status"], { isConfigured: false });
  queryClient.setQueryData(["/api/quick-bits"], DEMO_QUICK_BITS);
  DEMO_NOTES.forEach((note) => {
    queryClient.setQueryData([`/api/notes/${note.id}`], note);
  });
  DEMO_QUICK_BITS.forEach((qb) => {
    queryClient.setQueryData([`/api/quick-bits/${qb.id}`], qb);
  });
  setIsDemo(true);
}

function LoginScreen({ onDemo }: { onDemo: () => void }) {
  const { loginWithOAuth, loginWithEmail, signUpWithEmail, isLoading: authLoading } = useAuth();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      if (isSignUp) {
        const result = await signUpWithEmail(email, password);
        if (result.error) {
          setError(result.error);
        } else {
          setSuccessMsg("Check your email to confirm your account.");
        }
      } else {
        const result = await loginWithEmail(email, password);
        if (result.error) {
          setError(result.error);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-3">
          <img src={grapheLogo} alt="Graphe Notes" className="w-20 h-20 rounded-2xl shadow-lg" />
          <h1 className="text-2xl font-semibold text-foreground">Graphe Notes</h1>
          <p className="text-sm text-muted-foreground text-center">
            Notes that get you, wherever you go.
          </p>
        </div>

        <div className="w-full flex flex-col gap-3">
          <button
            onClick={() => loginWithOAuth("google")}
            className="w-full py-3 px-6 rounded-xl bg-white text-gray-800 font-medium text-sm hover:bg-gray-50 transition-colors shadow-sm border border-gray-200 flex items-center justify-center gap-3"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {!showEmailForm ? (
            <button
              onClick={() => setShowEmailForm(true)}
              className="w-full py-3 px-6 rounded-xl bg-muted text-foreground font-medium text-sm hover:bg-muted/80 transition-colors flex items-center justify-center gap-3"
            >
              <Mail className="w-5 h-5" />
              Continue with email
            </button>
          ) : (
            <form onSubmit={handleEmailSubmit} className="w-full flex flex-col gap-3">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full py-3 px-4 rounded-xl bg-muted text-foreground text-sm border border-border focus:border-primary focus:outline-none transition-colors"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full py-3 px-4 rounded-xl bg-muted text-foreground text-sm border border-border focus:border-primary focus:outline-none transition-colors"
              />

              {error && (
                <p className="text-xs text-red-500 text-center">{error}</p>
              )}
              {successMsg && (
                <p className="text-xs text-green-500 text-center">{successMsg}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-6 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSignUp ? "Create account" : "Sign in"}
              </button>

              <button
                type="button"
                onClick={() => { setIsSignUp(!isSignUp); setError(null); setSuccessMsg(null); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
              >
                {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Create one"}
              </button>
            </form>
          )}

          <button
            onClick={onDemo}
            className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
          >
            Try a demo without signing in →
          </button>
        </div>
      </div>
    </div>
  );
}

function AuthGate({ children, isDemo, onDemo }: { children: React.ReactNode; isDemo: boolean; onDemo: () => void }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated && !isDemo) {
    return <LoginScreen onDemo={onDemo} />;
  }

  return <>{children}</>;
}

export default function AppPage() {
  const [isDemo, setIsDemo] = useState(false);
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  // If the user logs in during a demo session, wipe all demo cache data and
  // reset the demo flag so real notes are fetched fresh from the API.
  useEffect(() => {
    if (isAuthenticated && isDemo) {
      queryClient.clear();
      setIsDemo(false);
    }
  }, [isAuthenticated, isDemo, queryClient]);

  const handleEnterDemo = () => enterDemoMode(queryClient, setIsDemo);

  return (
    <DemoContext.Provider value={isDemo}>
      <AuthGate isDemo={isDemo} onDemo={handleEnterDemo}>
        <Home />
      </AuthGate>
    </DemoContext.Provider>
  );
}
