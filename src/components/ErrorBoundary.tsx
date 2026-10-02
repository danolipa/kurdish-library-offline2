import React from "react";
import { logCrash } from "../lib/offlineCrashReporter";

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    logCrash(error);
    console.error(error);
  }

  render(): React.ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          textAlign: "center",
        }}
      >
        <section>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <h1>کتێبخانەی کوردی نەیتوانی پەڕەکە بار بکات</h1>
          <p>دەتوانیت ئەپەکە دووبارە بار بکەیتەوە.</p>
          <button type="button" onClick={() => location.reload()}>
            🔄 دووبارە بارکردنەوە
          </button>
        </section>
      </main>
    );
  }
}
