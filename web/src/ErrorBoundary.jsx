import { Component } from "react";

// Turns a white-screen crash into a readable message on the page, so a
// failure can be reported without digging through DevTools.

const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  background: "#1a0000",
  color: "#ffdddd",
  font: "14px/1.6 monospace",
  padding: "24px",
  overflow: "auto",
  whiteSpace: "pre-wrap",
};

function Overlay({ title, detail }) {
  return (
    <div style={overlayStyle}>
      <h2 style={{ color: "#ff6b6b", margin: "0 0 12px" }}>{title}</h2>
      {detail}
    </div>
  );
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, globalError: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidMount() {
    this.onError = (e) => {
      this.setState({
        globalError:
          "Uncaught error: " +
          (e.message || String(e.error)) +
          "\n" +
          (e.filename ? e.filename + ":" + e.lineno : ""),
      });
    };

    this.onRejection = (e) => {
      const reason = e.reason;
      this.setState({
        globalError:
          "Unhandled promise rejection: " +
          (reason && reason.message ? reason.message : String(reason)) +
          "\n" +
          (reason && reason.stack ? reason.stack : ""),
      });
    };

    window.addEventListener("error", this.onError);
    window.addEventListener("unhandledrejection", this.onRejection);
  }

  componentWillUnmount() {
    window.removeEventListener("error", this.onError);
    window.removeEventListener("unhandledrejection", this.onRejection);
  }

  render() {
    if (this.state.error) {
      return (
        <Overlay
          title="The app crashed"
          detail={
            this.state.error.message + "\n\n" + (this.state.error.stack || "")
          }
        />
      );
    }

    return (
      <>
        {this.props.children}
        {this.state.globalError && (
          <Overlay title="Error" detail={this.state.globalError} />
        )}
      </>
    );
  }
}

export default ErrorBoundary;
