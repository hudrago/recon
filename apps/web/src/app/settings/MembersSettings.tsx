'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, UserPlus, UserX } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { usePreferences } from '@/components/PreferencesProvider';
import { memberRoleLabel } from '@/lib/presentation';

const INVITABLE_ROLES = ['member', 'admin'] as const;
const ALL_ROLES = ['member', 'admin', 'owner'] as const;

function rolesOf(role: string): string[] {
  return role.split(',').map((value) => value.trim());
}

export function MembersSettings() {
  const router = useRouter();
  const { t, locale } = usePreferences();
  const { data: session } = authClient.useSession();
  const { data: organization, isPending } = authClient.useActiveOrganization();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<(typeof INVITABLE_ROLES)[number]>('member');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isPending || !organization) return null;

  const members = organization.members ?? [];
  const invitations = (organization.invitations ?? []).filter((invitation) => invitation.status === 'pending');
  const isOwner = members.some((member) => member.userId === session?.user.id && rolesOf(member.role).includes('owner'));

  function friendlyError(message?: string) {
    if (message && /owner/i.test(message)) return t('settings.members.lastOwner');
    return t('settings.members.error');
  }

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusyId('invite');
    const result = await authClient.organization.inviteMember({ email: inviteEmail, role: inviteRole });
    setBusyId(null);
    if (result.error) {
      setError(friendlyError(result.error.message));
      return;
    }
    setInviteEmail('');
    router.refresh();
  }

  async function cancelInvitation(invitationId: string) {
    setError(null);
    setBusyId(invitationId);
    const result = await authClient.organization.cancelInvitation({ invitationId });
    setBusyId(null);
    if (result.error) { setError(friendlyError(result.error.message)); return; }
    router.refresh();
  }

  async function removeMember(memberIdOrEmail: string) {
    setError(null);
    setBusyId(memberIdOrEmail);
    const result = await authClient.organization.removeMember({ memberIdOrEmail });
    setBusyId(null);
    if (result.error) { setError(friendlyError(result.error.message)); return; }
    router.refresh();
  }

  async function updateRole(memberId: string, role: string) {
    setError(null);
    setBusyId(memberId);
    const result = await authClient.organization.updateMemberRole({ memberId, role });
    setBusyId(null);
    if (result.error) { setError(friendlyError(result.error.message)); return; }
    router.refresh();
  }

  return (
    <section className="members-panel" aria-labelledby="members-title">
      <div>
        <p className="eyebrow">{t('settings.members.eyebrow')}</p>
        <h2 id="members-title">{t('settings.members.title')}</h2>
        <p>{t('settings.members.description')}</p>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}

      {members.map((member) => {
        const roles = rolesOf(member.role);
        const memberIsOwner = roles.includes('owner');
        return (
          <div key={member.id} className="member-row">
            <div><strong>{member.user.name || member.user.email}</strong><span>{member.user.email}</span></div>
            {isOwner && !memberIsOwner ? (
              <select value={roles[0]} disabled={busyId === member.id} onChange={(event) => updateRole(member.id, event.target.value)}>
                {ALL_ROLES.filter((role) => role !== 'owner').map((option) => (
                  <option key={option} value={option}>{memberRoleLabel(locale, option)}</option>
                ))}
              </select>
            ) : (
              <span className="member-role-badge">{memberRoleLabel(locale, roles[0])}</span>
            )}
            {isOwner && !memberIsOwner ? (
              <button type="button" className="button button-secondary" disabled={busyId === member.id} onClick={() => removeMember(member.id)}>
                <UserX size={16} aria-hidden="true" /> {t('settings.members.remove')}
              </button>
            ) : null}
          </div>
        );
      })}

      {invitations.map((invitation) => (
        <div key={invitation.id} className="member-row">
          <div><strong>{invitation.email}</strong><span>{t('settings.members.pending')}</span></div>
          <span className="member-role-badge">{memberRoleLabel(locale, invitation.role ?? 'member')}</span>
          {isOwner ? (
            <button type="button" className="button button-secondary" disabled={busyId === invitation.id} onClick={() => cancelInvitation(invitation.id)}>
              <Mail size={16} aria-hidden="true" /> {t('settings.members.cancelInvite')}
            </button>
          ) : null}
        </div>
      ))}

      {isOwner && (
        <form className="invite-form" onSubmit={submitInvite}>
          <label className="field">
            <span>{t('settings.members.inviteEmail')}</span>
            <input type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} />
          </label>
          <label className="field">
            <span>{t('settings.members.inviteRole')}</span>
            <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as (typeof INVITABLE_ROLES)[number])}>
              {INVITABLE_ROLES.map((option) => (
                <option key={option} value={option}>{memberRoleLabel(locale, option)}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="button" disabled={busyId === 'invite'}>
            <UserPlus size={16} aria-hidden="true" /> {busyId === 'invite' ? t('common.processing') : t('settings.members.invite')}
          </button>
        </form>
      )}
    </section>
  );
}
