import * as React from 'react';
import { getSkillName, SKILL_BANK } from '../../lib/glowup-banks';
import { cn } from '../../lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

type Props = {
  /** Selected skill id, or null for none. */
  value: string | null;
  onChange: (skillId: string | null) => void;
  placeholder: string;
  id?: string;
  'aria-label'?: string;
  className?: string;
  /** Skill ids to leave out, e.g. ones already tagged on this story. */
  exclude?: string[];
  /**
   * Action mode: the picker triggers something and then returns to its
   * placeholder rather than showing a selection. Used for "tag all as" and
   * "add another skill", which are menus, not fields.
   */
  resetAfterSelect?: boolean;
};

/**
 * The skill picker, used in six places across Decode, Stories, and the
 * Library. A native select could not be themed, so its list rendered in OS
 * chrome and ignored Night and Dawn entirely.
 */
export default function SkillSelect({
  value,
  onChange,
  placeholder,
  id,
  'aria-label': ariaLabel,
  className,
  exclude = [],
  resetAfterSelect = false,
}: Props) {
  // Radix has no empty-string item, so a reset is a remount.
  const [resetKey, setResetKey] = React.useState(0);
  const options = SKILL_BANK.filter((skill) => !exclude.includes(skill.id));

  return (
    <Select
      key={resetKey}
      value={resetAfterSelect ? undefined : (value ?? undefined)}
      onValueChange={(next) => {
        onChange(next || null);
        if (resetAfterSelect) setResetKey((k) => k + 1);
      }}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        className={cn('border-border/50 bg-overlay/30', className)}
      >
        <SelectValue placeholder={placeholder}>
          {!resetAfterSelect && value ? getSkillName(value) : placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-72 border border-border/60 bg-popover">
        {options.map((skill) => (
          <SelectItem key={skill.id} value={skill.id}>
            {skill.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
