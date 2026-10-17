import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import MyRoles from './MyRoles';
import { t, setLang } from '../i18n';

beforeEach(() => setLang('zh'));

describe('MyRoles', () => {
  it('a member without roles sees they are a member and what members can do', () => {
    render(<MyRoles roles={[]} status="member" />);
    expect(screen.getByText(t('role.member'), { selector: '.chip' })).toBeInTheDocument();
    expect(screen.getByText(t('status.member'))).toBeInTheDocument();
    expect(screen.getByText(t('roleCan.member'))).toBeInTheDocument();
    expect(screen.queryByText(t('roleCan.finance'))).not.toBeInTheDocument();
  });

  it('lists every role held, with what each allows', () => {
    render(<MyRoles roles={['scanner', 'finance']} status="regular" />);
    expect(screen.getByText(t('role.scanner'), { selector: '.chip' })).toBeInTheDocument();
    expect(screen.getByText(t('role.finance'), { selector: '.chip' })).toBeInTheDocument();
    expect(screen.getByText(t('roleCan.scanner'))).toBeInTheDocument();
    expect(screen.getByText(t('roleCan.finance'))).toBeInTheDocument();
    expect(screen.queryByText(t('roleCan.admin'))).not.toBeInTheDocument();
  });
});
