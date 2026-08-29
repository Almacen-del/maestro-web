import {useEffect, useMemo, useState} from "react";

import type {ManageableUser, MonitorRepository, MonitorRole, MonitorUser} from "../domain/MonitorModels";

interface UsersSectionProps {
  readonly repository: MonitorRepository;
  readonly currentUser: MonitorUser;
}

interface UserDialog {
  readonly kind: "STATUS" | "ROLE";
  readonly user: ManageableUser;
  readonly nextActive?: boolean;
  readonly nextRole?: MonitorRole;
  readonly reason: string;
  readonly confirmed: boolean;
  readonly idempotencyKey: string;
  readonly attempted: boolean;
}

interface CreateUserDialog {
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
  readonly passwordConfirmation: string;
  readonly role: MonitorRole;
  readonly idempotencyKey: string;
  readonly attempted: boolean;
}

const roleLabels: Record<MonitorRole, string> = {
  AUXILIAR: "Auxiliar",
  SUPERVISOR: "Supervisor",
  ADMINISTRADOR: "Administrador",
};

function workSummary(user: ManageableUser): string {
  const work = user.activeWork;
  if (!work.hasActiveWork) return "Sin trabajo operativo activo";
  return [
    work.activeJourneys > 0 ? `${work.activeJourneys} jornada(s)` : undefined,
    work.activeReservations > 0 ? `${work.activeReservations} reserva(s)` : undefined,
    work.pendingCorrections > 0 ? `${work.pendingCorrections} corrección(es)` : undefined,
  ].filter(Boolean).join(" · ");
}

export function UsersSection({repository, currentUser}: UsersSectionProps) {
  const [users, setUsers] = useState<readonly ManageableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"TODOS" | MonitorRole>("TODOS");
  const [stateFilter, setStateFilter] = useState<"TODOS" | "ACTIVO" | "INACTIVO">("TODOS");
  const [dialog, setDialog] = useState<UserDialog>();
  const [createDialog, setCreateDialog] = useState<CreateUserDialog>();

  const loadUsers = async () => {
    setLoading(true);
    setError(undefined);
    try {
      setUsers(await repository.listManageableUsers());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible consultar los usuarios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const visibleUsers = useMemo(() => users.filter((user) => {
    const normalizedSearch = search.trim().toLocaleLowerCase("es");
    return user.displayName.toLocaleLowerCase("es").includes(normalizedSearch) &&
      (roleFilter === "TODOS" || user.role === roleFilter) &&
      (stateFilter === "TODOS" || (stateFilter === "ACTIVO" ? user.active : !user.active));
  }), [users, search, roleFilter, stateFilter]);

  const openStatus = (user: ManageableUser) => {
    setError(undefined);
    setNotice(undefined);
    setCreateDialog(undefined);
    setDialog({
      kind: "STATUS",
      user,
      nextActive: !user.active,
      reason: "",
      confirmed: false,
      idempotencyKey: crypto.randomUUID(),
      attempted: false,
    });
  };

  const openRole = (user: ManageableUser) => {
    setError(undefined);
    setNotice(undefined);
    setCreateDialog(undefined);
    setDialog({
      kind: "ROLE",
      user,
      nextRole: user.role === "AUXILIAR" ? "SUPERVISOR" : "AUXILIAR",
      reason: "",
      confirmed: false,
      idempotencyKey: crypto.randomUUID(),
      attempted: false,
    });
  };

  const updateDialog = (changes: Partial<Pick<UserDialog, "nextRole" | "reason" | "confirmed">>) => {
    setDialog((current) => current && ({
      ...current,
      ...changes,
      idempotencyKey: current.attempted ? crypto.randomUUID() : current.idempotencyKey,
      attempted: false,
    }));
  };

  const openCreate = () => {
    setError(undefined);
    setNotice(undefined);
    setDialog(undefined);
    setCreateDialog({
      displayName: "",
      email: "",
      password: "",
      passwordConfirmation: "",
      role: "AUXILIAR",
      idempotencyKey: crypto.randomUUID(),
      attempted: false,
    });
  };

  const updateCreateDialog = (
    changes: Partial<Pick<CreateUserDialog, "displayName" | "email" | "password" | "passwordConfirmation" | "role">>,
  ) => {
    setCreateDialog((current) => current && ({
      ...current,
      ...changes,
      idempotencyKey: current.attempted ? crypto.randomUUID() : current.idempotencyKey,
      attempted: false,
    }));
  };

  const submitCreate = async () => {
    if (!createDialog || saving) return;
    const displayName = createDialog.displayName.trim();
    const email = createDialog.email.trim();
    if (!displayName || !email || !createDialog.password || !createDialog.passwordConfirmation) {
      setError("Completa todos los campos para crear el usuario.");
      return;
    }
    if (displayName.length > 160) {
      setError("El nombre visible no puede superar 160 caracteres.");
      return;
    }
    if (email.length > 254) {
      setError("El correo electrónico no puede superar 254 caracteres.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Escribe un correo electrónico válido.");
      return;
    }
    if (createDialog.password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (createDialog.password.length > 128) {
      setError("La contraseña no puede superar 128 caracteres.");
      return;
    }
    if (createDialog.password !== createDialog.passwordConfirmation) {
      setError("La contraseña y su confirmación no coinciden.");
      return;
    }
    setSaving(true);
    setError(undefined);
    setCreateDialog({...createDialog, displayName, email, attempted: true});
    try {
      const created = await repository.createManageableUser(
        displayName,
        email,
        createDialog.password,
        createDialog.role,
        createDialog.idempotencyKey,
      );
      setUsers((current) => current.some((user) => user.id === created.id)
        ? current.map((user) => user.id === created.id ? created : user)
        : [...current, created]);
      setNotice(`Usuario ${created.displayName} creado como ${roleLabels[created.role]}.`);
      setCreateDialog(undefined);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No fue posible crear el usuario.");
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (!dialog || saving) return;
    const reason = dialog.reason.trim();
    if (!reason) {
      setError("Escribe el motivo obligatorio del cambio.");
      return;
    }
    if (!dialog.confirmed) {
      setError("Confirma explícitamente el cambio antes de continuar.");
      return;
    }
    if (dialog.kind === "ROLE" && (!dialog.nextRole || dialog.nextRole === dialog.user.role)) {
      setError("Selecciona un rol diferente del actual.");
      return;
    }
    setSaving(true);
    setError(undefined);
    setDialog({...dialog, reason, attempted: true});
    try {
      const updated = dialog.kind === "STATUS"
        ? await repository.updateUserStatus(
            dialog.user.id,
            dialog.user.version,
            dialog.nextActive === true,
            reason,
            dialog.idempotencyKey,
          )
        : await repository.updateUserRole(
            dialog.user.id,
            dialog.user.version,
            dialog.nextRole as MonitorRole,
            reason,
            dialog.idempotencyKey,
          );
      setUsers((current) => current.map((user) => user.id === updated.id ? updated : user));
      setNotice(dialog.kind === "STATUS"
        ? `Estado de ${updated.displayName} actualizado a ${updated.active ? "ACTIVO" : "INACTIVO"}.`
        : `Rol de ${updated.displayName} actualizado a ${roleLabels[updated.role]}.`);
      setDialog(undefined);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No fue posible actualizar el perfil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="monitor users-section" aria-labelledby="users-title">
      <div className="monitor-heading">
        <div>
          <p className="eyebrow">ETAPA 25</p>
          <h1 id="users-title">Usuarios</h1>
          <p>Cuentas de acceso y perfiles centrales administrados sin reemplazar la sesión actual.</p>
        </div>
        <div className="user-card__actions">
          <button className="button" type="button" onClick={openCreate}>Crear usuario</button>
          <button className="button button--secondary" type="button" onClick={() => void loadUsers()} disabled={loading}>
            Actualizar
          </button>
        </div>
      </div>

      <div className="monitor-filters users-filters">
        <label>
          Buscar por nombre
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre visible" />
        </label>
        <label>
          Rol
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}>
            <option value="TODOS">Todos</option>
            <option value="AUXILIAR">Auxiliar</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="ADMINISTRADOR">Administrador</option>
          </select>
        </label>
        <label>
          Estado
          <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value as typeof stateFilter)}>
            <option value="TODOS">Todos</option>
            <option value="ACTIVO">Activo</option>
            <option value="INACTIVO">Inactivo</option>
          </select>
        </label>
      </div>

      {error && <p className="alert" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      {loading ? <p>Cargando perfiles centrales…</p> : (
        <div className="users-grid" aria-label="Perfiles administrables">
          {visibleUsers.map((user) => (
            <article className={user.active ? "user-card" : "user-card user-card--inactive"} key={user.id}>
              <div className="user-card__heading">
                <div>
                  <strong>{user.displayName}</strong>
                  <small>{roleLabels[user.role]} · versión {user.version}</small>
                </div>
                <span className={user.active ? "state-chip state-chip--active" : "state-chip state-chip--inactive"}>
                  {user.active ? "ACTIVO" : "INACTIVO"}
                </span>
              </div>
              <p className={user.activeWork.hasActiveWork ? "work-warning" : "work-clear"}>
                {workSummary(user)}
              </p>
              {user.activeWork.hasActiveWork && (
                <small>Desactivar no libera ni reasigna este trabajo.</small>
              )}
              <div className="user-card__actions">
                <button
                  className={user.active ? "button button--danger" : "button"}
                  type="button"
                  onClick={() => openStatus(user)}
                  disabled={user.id === currentUser.id && user.active}
                  title={user.id === currentUser.id && user.active ? "No puedes desactivar tu propia cuenta." : undefined}
                >
                  {user.active ? "Desactivar" : "Reactivar"}
                </button>
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => openRole(user)}
                  disabled={!user.canChangeRole || user.id === currentUser.id}
                  title={!user.canChangeRole
                    ? "El trabajo activo bloquea el cambio de rol."
                    : user.id === currentUser.id
                      ? "No puedes retirar tu propio rol administrador."
                      : undefined}
                >
                  Cambiar rol
                </button>
              </div>
            </article>
          ))}
          {visibleUsers.length === 0 && <p>No hay usuarios que coincidan con los filtros.</p>}
        </div>
      )}

      {dialog && (
        <div className="dialog-backdrop">
          <section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="user-change-title">
            <h2 id="user-change-title">
              {dialog.kind === "STATUS"
                ? `${dialog.nextActive ? "Reactivar" : "Desactivar"} perfil`
                : "Cambiar rol"}
            </h2>
            <p><strong>{dialog.user.displayName}</strong> · versión observada {dialog.user.version}</p>
            {dialog.kind === "ROLE" && (
              <label>
                Nuevo rol
                <select
                  value={dialog.nextRole}
                  onChange={(event) => updateDialog({nextRole: event.target.value as MonitorRole})}
                >
                  <option value="AUXILIAR">Auxiliar</option>
                  <option value="SUPERVISOR">Supervisor</option>
                  <option value="ADMINISTRADOR">Administrador</option>
                </select>
              </label>
            )}
            <label>
              Motivo obligatorio
              <textarea
                maxLength={2000}
                value={dialog.reason}
                onChange={(event) => updateDialog({reason: event.target.value})}
                placeholder="Explica por qué se realiza este cambio"
              />
            </label>
            {dialog.kind === "STATUS" && dialog.nextActive === false && dialog.user.activeWork.hasActiveWork && (
              <p className="alert">
                Trabajo conservado: {workSummary(dialog.user)}. No se liberará ni reasignará automáticamente; debe
                resolverse mediante los flujos supervisados.
              </p>
            )}
            <label className="confirmation-check">
              <input
                type="checkbox"
                checked={dialog.confirmed}
                onChange={(event) => updateDialog({confirmed: event.target.checked})}
              />
              Confirmo el cambio central de este perfil.
            </label>
            <div className="dialog-actions">
              <button className="button button--secondary" type="button" onClick={() => setDialog(undefined)} disabled={saving}>
                Cancelar
              </button>
              <button className="button" type="button" onClick={() => void submit()} disabled={saving}>
                {saving ? "Guardando…" : "Confirmar cambio"}
              </button>
            </div>
          </section>
        </div>
      )}

      {createDialog && (
        <div className="dialog-backdrop">
          <section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="create-user-title">
            <h2 id="create-user-title">Crear usuario</h2>
            <p>La cuenta podrá iniciar sesión inmediatamente; no se enviará correo de verificación.</p>
            <label>
              Nombre visible
              <input
                autoComplete="name"
                maxLength={160}
                required
                value={createDialog.displayName}
                onChange={(event) => updateCreateDialog({displayName: event.target.value})}
              />
            </label>
            <label>
              Correo electrónico
              <input
                autoComplete="username"
                maxLength={254}
                required
                type="email"
                value={createDialog.email}
                onChange={(event) => updateCreateDialog({email: event.target.value})}
              />
            </label>
            <label>
              Contraseña
              <input
                autoComplete="new-password"
                maxLength={128}
                required
                type="password"
                value={createDialog.password}
                onChange={(event) => updateCreateDialog({password: event.target.value})}
              />
            </label>
            <label>
              Confirmar contraseña
              <input
                autoComplete="new-password"
                maxLength={128}
                required
                type="password"
                value={createDialog.passwordConfirmation}
                onChange={(event) => updateCreateDialog({passwordConfirmation: event.target.value})}
              />
            </label>
            <label>
              Rol
              <select
                required
                value={createDialog.role}
                onChange={(event) => updateCreateDialog({role: event.target.value as MonitorRole})}
              >
                <option value="AUXILIAR">Auxiliar</option>
                <option value="SUPERVISOR">Supervisor</option>
                <option value="ADMINISTRADOR">Administrador</option>
              </select>
            </label>
            <div className="dialog-actions">
              <button
                className="button button--secondary"
                type="button"
                onClick={() => setCreateDialog(undefined)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button className="button" type="button" onClick={() => void submitCreate()} disabled={saving}>
                {saving ? "Creando…" : "Crear usuario"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
