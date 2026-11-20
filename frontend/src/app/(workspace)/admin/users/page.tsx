"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost, ApiError } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type AdminUser = { id: string; fullName: string; email: string; role: "ADMIN" | "SUBMITTER" | "APPROVER"; isActive: boolean };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminUser["role"]>("SUBMITTER");

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
            <form className="grid gap-3 md:grid-cols-5" onSubmit={async (event) => { event.preventDefault(); try { await apiPost<AdminUser>("/users", { fullName, email, password, role }); setFullName(""); setEmail(""); setPassword(""); setRole("SUBMITTER"); toast.success("User created."); await load(); } catch (caught) { toast.error(caught instanceof ApiError ? caught.message : "Could not create user."); } }}>
              <div className="space-y-1"><Label htmlFor="new-name">Name</Label><Input id="new-name" value={fullName} onChange={(event) => setFullName(event.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="new-email">Email</Label><Input id="new-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="new-password">Password</Label><Input id="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></div>
              <div className="space-y-1"><Label>Role</Label><Select value={role} onValueChange={(value) => setRole(value as AdminUser["role"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SUBMITTER">Submitter</SelectItem><SelectItem value="APPROVER">Approver</SelectItem><SelectItem value="ADMIN">Admin</SelectItem></SelectContent></Select></div>
              <div className="flex items-end"><Button type="submit" className="w-full">Create</Button></div>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Users</CardTitle></CardHeader>
          <CardContent className="space-y-2">{loading ? <p>Loading users...</p> : users.map((user) => (
            <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div><p className="font-medium">{user.fullName}</p><p className="text-xs text-muted-foreground">{user.email}</p></div>
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
