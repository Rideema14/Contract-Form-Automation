"use client";

import { type FormEvent, useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost, ApiError } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy } from "lucide-react";
import { toast } from "sonner";

type AdminUser = { id: string; fullName: string; email: string; role: "ADMIN" | "SUBMITTER" | "APPROVER"; isActive: boolean };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [showCredentialsPassword, setShowCredentialsPassword] = useState(true);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [role, setRole] = useState<AdminUser["role"]>("SUBMITTER");

  async function copyPassword(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Password copied.");
    } catch {
      toast.error("Could not copy password.");
    }
  }

  function selectUser(user: AdminUser) {
    setSelectedUser(user);
    setEditFullName(user.fullName);
    setEditEmail(user.email);
    setEditPassword("");
    setShowEditPassword(false);
  }

  async function saveUserChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUser) return;

    const changes: { fullName?: string; email?: string; password?: string } = {};
    if (editFullName.trim() !== selectedUser.fullName) changes.fullName = editFullName.trim();
    if (editEmail.trim() !== selectedUser.email) changes.email = editEmail.trim();
    if (editPassword) changes.password = editPassword;
    if (!Object.keys(changes).length) return;

    try {
      const updated = await apiPatch<AdminUser>(`/users/${selectedUser.id}`, changes);
      setUsers((current) => current.map((user) => user.id === updated.id ? updated : user));
      setSelectedUser(updated);
      setEditFullName(updated.fullName);
      setEditEmail(updated.email);
      setEditPassword("");
      setShowEditPassword(false);
      toast.success("User updated.");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not update user.");
    }
  }

  async function load() {
    try {
      const data = await apiGet<{ items: AdminUser[] }>("/users");
      setUsers(data.items);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <main className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div><h1 className="text-3xl font-bold">User administration</h1><p className="text-muted-foreground">Create users and manage roles and access.</p></div>
        <Card>
          <CardHeader><CardTitle>Create user</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-5" onSubmit={async (event) => { event.preventDefault(); try { await apiPost<AdminUser>("/users", { fullName, email, password, role }); setCredentials({ email, password }); setShowCredentialsPassword(true); setFullName(""); setEmail(""); setPassword(""); setShowPassword(false); setRole("SUBMITTER"); toast.success("User created."); await load(); } catch (caught) { toast.error(caught instanceof ApiError ? caught.message : "Could not create user."); } }}>
              <div className="space-y-1"><Label htmlFor="new-name">Name</Label><Input id="new-name" value={fullName} onChange={(event) => setFullName(event.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="new-email">Email</Label><Input id="new-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="new-password">Password</Label><Input id="new-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} /><div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? "Hide" : "Show"}</Button><Button type="button" variant="outline" size="sm" disabled={!password} onClick={() => void copyPassword(password)}><Copy className="mr-1 size-3.5" />Copy Password</Button></div></div>
              <div className="space-y-1"><Label>Role</Label><Select value={role} onValueChange={(value) => setRole(value as AdminUser["role"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SUBMITTER">Submitter</SelectItem><SelectItem value="APPROVER">Approver</SelectItem><SelectItem value="ADMIN">Admin</SelectItem></SelectContent></Select></div>
              <div className="flex items-end"><Button type="submit" className="w-full">Create</Button></div>
            </form>
          </CardContent>
        </Card>
        {selectedUser && (
          <Card>
            <CardHeader><CardTitle>Edit User: {selectedUser.fullName}</CardTitle></CardHeader>
            <CardContent>
              <form className="grid gap-3 md:grid-cols-4" onSubmit={(event) => void saveUserChanges(event)}>
                <div className="space-y-1">
                  <Label htmlFor="edit-name">Name</Label>
                  <Input id="edit-name" required value={editFullName} onChange={(event) => setEditFullName(event.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input id="edit-email" type="email" required value={editEmail} onChange={(event) => setEditEmail(event.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-password">New password (leave blank to keep current)</Label>
                  <Input id="edit-password" type={showEditPassword ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={128} value={editPassword} onChange={(event) => setEditPassword(event.target.value)} />
                  <p className="text-xs text-muted-foreground">Current passwords cannot be viewed. Enter a new password only if you want to change it.</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowEditPassword((shown) => !shown)}>{showEditPassword ? "Hide" : "Show"} Password</Button>
                </div>
                <div className="flex items-end gap-2">
                  <Button type="submit" disabled={editFullName.trim() === selectedUser.fullName && editEmail.trim() === selectedUser.email && !editPassword}>Save Changes</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
        {credentials && (
          <Card>
            <CardHeader><CardTitle>New user credentials</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap items-end gap-4">
              <div className="space-y-1"><Label>Email</Label><p className="font-mono text-sm">{credentials.email}</p></div>
              <div className="space-y-1"><Label>Password</Label><p className="font-mono text-sm">{showCredentialsPassword ? credentials.password : "••••••••••••"}</p></div>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowCredentialsPassword((shown) => !shown)}>{showCredentialsPassword ? "Hide" : "Show"} Password</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void copyPassword(credentials.password)}><Copy className="mr-1 size-3.5" />Copy Password</Button>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader><CardTitle>Users</CardTitle></CardHeader>
          <CardContent className="space-y-2">{loading ? <p>Loading users...</p> : users.map((user) => (
            <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <button type="button" className="text-left" onClick={() => selectUser(user)} aria-label={`Edit ${user.fullName}`}>
                <p className="font-medium">{user.fullName}</p><p className="text-xs text-muted-foreground">{user.email}</p>
              </button>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{user.role}</Badge>
                <Badge variant={user.isActive ? "default" : "secondary"}>{user.isActive ? "Active" : "Inactive"}</Badge>
                <Select value={user.role} onValueChange={(value) => void apiPatch<AdminUser>(`/users/${user.id}`, { role: value }).then((updated) => setUsers((current) => current.map((item) => item.id === updated.id ? updated : item))).catch((caught) => toast.error(caught instanceof ApiError ? caught.message : "Could not update role."))}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SUBMITTER">Submitter</SelectItem><SelectItem value="APPROVER">Approver</SelectItem><SelectItem value="ADMIN">Admin</SelectItem></SelectContent></Select>
                <Button type="button" variant="outline" size="sm" onClick={() => void apiPatch<AdminUser>(`/users/${user.id}`, { isActive: !user.isActive }).then((updated) => setUsers((current) => current.map((item) => item.id === updated.id ? updated : item))).catch((caught) => toast.error(caught instanceof ApiError ? caught.message : "Could not update status."))}>{user.isActive ? "Deactivate" : "Activate"}</Button>
              </div>
            </div>
          ))}</CardContent>
        </Card>
      </div>
    </main>
  );
}
