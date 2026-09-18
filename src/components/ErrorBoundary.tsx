import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 h-full select-none">
          <div className="w-14 h-14 bg-red-100 dark:bg-red-950/50 text-red-500 rounded-2xl flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold mb-1">কিছু একটা সমস্যা হয়েছে</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4">
            বার্তা লোড করার সময় সমস্যা হয়েছিল। অনুগ্রহ করে পেজটি রিফ্রেশ করুন।
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>পেজ রিলোড করুন</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
