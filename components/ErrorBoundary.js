"use client";
import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "40px 24px", fontFamily: "sans-serif" }}>
          <h2>Something went wrong</h2>
          <pre style={{ background: "#f5f5f5", padding: 16, fontSize: 13, overflow: "auto" }}>
            {this.state.error?.message}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 12, padding: "8px 16px" }}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}