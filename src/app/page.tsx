
"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import dynamic from "next/dynamic";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const Editor = dynamic(() => import("@/components/Editor"), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg border bg-white p-6 text-gray-600">
      Loading document editor...
    </div>
  ),
});

type DocumentRecord = {
  id: string;
  title: string;
  content: string;
  owner_id: string;
  updated_at: string;
};

const EMPTY_CONTENT = "<p></p>";

function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  return escaped
    .split(/\r?\n/)
    .map((line) => `<p>${line || "<br>"}</p>`)
    .join("");
}

export default function Home() {
  // Authentication
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Documents
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftVersion, setDraftVersion] = useState(0);
  const [title, setTitle] = useState("Untitled Document");
  const [content, setContent] = useState(EMPTY_CONTENT);

  // UI state
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showDebug, setShowDebug] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");

  const selectedDocument = documents.find((doc) => doc.id === activeId);
  const isOwner = !selectedDocument || selectedDocument.owner_id === user?.id;
  const myDocuments = documents.filter((doc) => doc.owner_id === user?.id);
  const sharedDocuments = documents.filter((doc) => doc.owner_id !== user?.id);

  // Restore session and observe sign-in changes.
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;

      if (error) setError(error.message);
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        setUser(session?.user ?? null);
        setAuthLoading(false);
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Load the signed-in user's documents.
  useEffect(() => {
    let cancelled = false;

    if (!user) {
      return;
    }

    async function load() {
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, content, owner_id, updated_at")
        .order("updated_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        setError(error.message);
      } else {
        setDocuments((data ?? []) as DocumentRecord[]);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Login
  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      setPassword("");
      setMessage("Signed in successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Login failed."
      );
    } finally {
      setBusy(false);
    }
  }

  // Logout
  async function handleLogout() {
    if (dirty && !window.confirm("Discard unsaved changes and sign out?")) {
      return;
    }

    setError("");

    const { error } = await supabase.auth.signOut();

    if (error) {
      setError(error.message);
      return;
    }

    setUser(null);
    setDocuments([]);
    setActiveId(null);
    setTitle("Untitled Document");
    setContent(EMPTY_CONTENT);
    setDirty(false);
    setDraftVersion((v) => v + 1);
    setMessage("");
    setShowShare(false);
    setRecipientEmail("");
  }

  async function handleFileUpload(
  event: React.ChangeEvent<HTMLInputElement>
) {
  const file = event.target.files?.[0];

  if (!file) return;

  // Allow selecting the same file again.
  event.target.value = "";

  if (dirty && !window.confirm("Discard unsaved changes and import this file?")) {
    return;
  }

  if (!file.name.toLowerCase().endsWith(".txt")) {
    setError("Only .txt files are supported.");
    return;
  }

  const MAX_SIZE = 1024 * 1024; // 1 MB

  if (file.size > MAX_SIZE) {
    setError("The file must be 1 MB or smaller.");
    return;
  }

  setBusy(true);
  setError("");
  setMessage("");

  try {
    const text = await file.text();

    const filename = file.name.replace(/\.txt$/i, "");

    setActiveId(null);
    setTitle(filename.slice(0, 200) || "Imported Document");
    setContent(textToHtml(text));
    setDraftVersion((version) => version + 1);
    setDirty(true);
    setMessage(
      `Imported "${file.name}". Click Save Document to store it.`
    );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "File import failed."
        );
      } finally {
        setBusy(false);
      }
    }

  // Create a fresh local draft.
  function handleNewDocument() {
    if (dirty && !window.confirm("Discard unsaved changes?")) {
      return;
    }

    setActiveId(null);
    setTitle("Untitled Document");
    setContent(EMPTY_CONTENT);
    setDirty(false);
    setDraftVersion((v) => v + 1);
    setMessage("New document ready. Click Save to store it.");
    setShowShare(false);
    setError("");
  }

  // Open a document from the database.
  async function handleOpenDocument(id: string) {
    if (dirty && !window.confirm("Discard unsaved changes?")) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, content, owner_id, updated_at")
        .eq("id", id)
        .single();

      if (error) throw error;

      const doc = data as DocumentRecord;

      setActiveId(doc.id);
      setTitle(doc.title);
      setContent(doc.content || EMPTY_CONTENT);
      setDirty(false);
      setDraftVersion((v) => v + 1);
      setMessage(`Opened "${doc.title}".`);
      setShowShare(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not open document."
      );
    } finally {
      setBusy(false);
    }
  }

  // Save new or existing document.
  
async function handleSave() {
  if (!user || saving || !isOwner) return;

  const cleanTitle = title.trim();

  if (!cleanTitle) {
    setError("Document title cannot be empty.");
    return;
  }

  if (cleanTitle.length > 200) {
    setError("Document title must be 200 characters or fewer.");
    return;
  }

  setSaving(true);
  setError("");
  setMessage("");

    try {
      const payload = {
        title: cleanTitle,
        content,
        updated_at: new Date().toISOString(),
      };

      let result;

      if (activeId) {
        result = await supabase
          .from("documents")
          .update(payload)
          .eq("id", activeId)
          .eq("owner_id", user.id)
          .select("id, title, content, owner_id, updated_at")
          .single();
      } else {
        result = await supabase
          .from("documents")
          .insert({
            ...payload,
            owner_id: user.id,
          })
          .select("id, title, content, owner_id, updated_at")
          .single();
      }

      if (result.error) throw result.error;

      const saved = result.data as DocumentRecord;

      setActiveId(saved.id);
      setTitle(saved.title);
      setDirty(false);

      // Update the document list without reloading.
      setDocuments((previous) => [
        saved,
        ...previous.filter((doc) => doc.id !== saved.id),
      ]);

      setMessage("Document saved successfully!");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save document."
      );
    } finally {
      setSaving(false);
    }
  }

  // The owner can grant another registered user view-only access.
  async function handleShare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !activeId || !isOwner || busy) return;
    if (dirty) {
      setError("Save your changes before sharing this document.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error } = await supabase.rpc("share_document_by_email", {
        p_document_id: activeId,
        p_email: recipientEmail.trim(),
      });
      if (error) throw error;
      setMessage(`Shared with ${recipientEmail.trim()} (view only).`);
      setRecipientEmail("");
      setShowShare(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sharing failed.");
    } finally {
      setSaving(false);
    }
  }

  // Waiting for Supabase authentication.
  if (authLoading) {
    return (
      <main className="min-h-screen bg-gray-100 p-8 text-gray-900">
        <p>Loading TeamDocs...</p>
      </main>
    );
  }

  // Login screen
  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 p-6 text-gray-900">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="mb-2 text-3xl font-bold text-blue-700">
            TeamDocs
          </h1>

          <p className="mb-6 text-gray-500">
            Sign in to your document workspace.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-3"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-3"
              />
            </div>

            {/* Password recovery link */}
            <div className="text-right">
              <a
                href="/forgot-password"
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                Forgot Password?
              </a>
            </div>

            {/* Existing error message and Sign In button remain below */}

            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  // Document workspace
  return (
    <main className="min-h-screen bg-gray-100 p-6 text-gray-900">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-blue-700">
              TeamDocs
            </h1>
            <p className="text-sm text-gray-500">
              Collaborative Document Workspace
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              {user.email}
            </span>

            <button
              onClick={handleLogout}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 hover:bg-gray-50"
            >
              Sign Out
            </button>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
          {/* Document sidebar */}
          <aside className="self-start rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <button
              onClick={handleNewDocument}
              disabled={busy || saving}
              className="mb-5 w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              + New Document
            </button>
              <label className="mb-5 block cursor-pointer rounded-lg border border-blue-600 bg-white px-4 py-3 text-center font-medium text-blue-700 hover:bg-blue-50">
                Upload .txt File
                <input
                  type="file"
                  accept=".txt,text/plain"
                  onChange={handleFileUpload}
                  disabled={busy || saving}
                  className="sr-only"
                  aria-label="Upload a text document"
                />
              </label>

            <h2 className="mb-3 font-semibold">
              My Documents ({myDocuments.length})
            </h2>

            {myDocuments.length === 0 ? (
              <p className="text-sm text-gray-500">
                No saved documents yet.
              </p>
            ) : (
              <div className="space-y-2">
                {myDocuments.map((doc) => (
                  <button
                    key={doc.id}
                    disabled={busy || saving}
                    onClick={() => void handleOpenDocument(doc.id)}
                    className={`w-full rounded-lg p-3 text-left text-sm hover:bg-gray-100 ${
                      activeId === doc.id
                        ? "bg-blue-50 ring-1 ring-blue-200"
                        : "bg-gray-50"
                    }`}
                  >
                    <div className="truncate font-medium">
                      {doc.title}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {new Date(doc.updated_at).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <hr className="my-5 border-gray-200" />
            <h2 className="mb-3 font-semibold">
              Shared With Me ({sharedDocuments.length})
            </h2>
            {sharedDocuments.length === 0 ? (
              <p className="text-sm text-gray-500">No shared documents yet.</p>
            ) : (
              <div className="space-y-2">
                {sharedDocuments.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    disabled={busy || saving}
                    onClick={() => void handleOpenDocument(doc.id)}
                    className={`w-full rounded-lg p-3 text-left text-sm hover:bg-gray-100 ${
                      activeId === doc.id ? "bg-purple-100" : "bg-gray-50"
                    }`}
                  >
                    <div className="truncate font-medium">{doc.title}</div>
                    <div className="mt-1 text-xs text-purple-700">View only</div>
                  </button>
                ))}
              </div>
            )}
          </aside>

          {/* Main editor */}
          <section className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-gray-600">
                {!isOwner
                  ? "Shared document — view only"
                  : dirty ? "● Unsaved changes" : "No unsaved changes"}
              </span>

              <div className="flex flex-wrap gap-2">
                {activeId && isOwner && (
                  <button
                    type="button"
                    onClick={() => setShowShare((value) => !value)}
                    className="rounded-lg bg-purple-600 px-4 py-2.5 font-semibold text-white hover:bg-purple-700"
                  >
                    Share Document
                  </button>
                )}
                {isOwner && (
              <button
                onClick={handleSave}
                disabled={saving || busy}
                className="rounded-lg bg-green-600 px-6 py-2.5 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Document"}
              </button>
                )}
              </div>
            </div>

            {error && (
              <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {message && !error && (
              <div role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                {message}
              </div>
            )}

            {showShare && activeId && isOwner && (
              <form onSubmit={handleShare} className="mb-5 rounded-lg border border-purple-200 bg-white p-4">
                <h2 className="mb-2 font-semibold">Share this document</h2>
                <p className="mb-3 text-sm text-gray-600">
                  Enter another registered TeamDocs user's email. Access is view-only.
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="email"
                    required
                    aria-label="Recipient email"
                    value={recipientEmail}
                    onChange={(event) => setRecipientEmail(event.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-gray-300 p-3"
                    placeholder="recipient@example.com"
                  />
                  <button
                    type="submit"
                    disabled={busy || dirty || !recipientEmail.trim()}
                    className="rounded-lg bg-purple-600 px-4 py-2 font-medium text-white disabled:opacity-50"
                  >
                    {busy ? "Sharing..." : "Grant Access"}
                  </button>
                </div>
              </form>
            )}

            <input
              value={title}
              maxLength={200}
              readOnly={!isOwner}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty(true);
              }}
              aria-label="Document title"
              className="mb-5 w-full rounded-lg border border-gray-300 bg-white p-3 text-xl font-semibold"
              placeholder="Document title"
            />

            <Editor
              key={activeId ?? `draft-${draftVersion}`}
              content={content}
              editable={isOwner}
              onChange={(html) => {
                if (!isOwner || html === content) return;
                setContent(html);
                setDirty(true);
              }}
            />

            <p className="mt-3 text-sm text-gray-500">
              {isOwner
                ? "Click Save Document to store your changes in Supabase."
                : "This document is shared with you in view-only mode."}
            </p>

            {/* Debugging controls */}
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setShowDebug(!showDebug)}
                className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700"
              >
                {showDebug ? "Hide HTML Debugger" : "Show HTML Debugger"}
              </button>
            </div>

            {showDebug && (
              <section className="mt-4 rounded-lg border border-gray-300 bg-white p-4">
                <h2 className="mb-2 font-semibold">
                  Live HTML Output
                </h2>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-gray-100 p-4 text-sm">
                  {content}
                </pre>
              </section>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}