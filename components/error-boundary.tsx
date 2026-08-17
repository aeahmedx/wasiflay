"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; label: string };
type State = { crashed: boolean };

/**
 * Required around every major surface (CLAUDE.md section 4). A crash in
 * the chat room must not blank the page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  componentDidCatch(error: unknown) {
    // Replaced by Sentry once instrumentation lands.
    console.error("Surface crashed:", this.props.label, error);
  }

  render() {
    if (!this.state.crashed) return this.props.children;

    return (
      <div className="p-6 text-center">
        <p className="text-stone-800 mb-3">
          {this.props.label} is having trouble.
        </p>
        <button
          onClick={() => this.setState({ crashed: false })}
          className="rounded-lg bg-emerald-800 px-4 py-2 font-medium text-white"
        >
          Reload
        </button>
      </div>
    );
  }
}
