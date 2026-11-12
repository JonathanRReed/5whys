import * as React from 'react';
import { getSkillName, SKILL_BANK, type Skill } from '../../lib/glowup-banks';
import { cn } from '../../lib/utils';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

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
  /**
   * Skill ids the current posting tests, most often first. They lead the
   * list so a logistics posting does not open on Python and JavaScript.
   */
  first?: readonly string[];
};

/** Without a posting: everyday skills first, technical ones last. */
const CATEGORY_ORDER: Record<Skill['category'], number> = {
  soft: 0,
  domain: 1,
  technical: 2,
  general: 3,
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
  first = [],
}: Props) {
  // Radix has no empty-string item, so a reset is a remount.
  const [resetKey, setResetKey] = React.useState(0);
  const available = SKILL_BANK.filter((skill) => !exclude.includes(skill.id));
  const leading = first
    .map((id) => available.find((skill) => skill.id === id))
    .filter((skill): skill is Skill => Boolean(skill));
  const rest = available
    .filter((skill) => !leading.includes(skill))
    .map((skill, order) => ({ skill, order }))
    .sort(
      (a, b) =>
        CATEGORY_ORDER[a.skill.category] - CATEGORY_ORDER[b.skill.category] || a.order - b.order
    )
    .map(({ skill }) => skill);

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
        {leading.length > 0 && (
          <>
            <SelectGroup>
              <SelectLabel>In this posting</SelectLabel>
              {leading.map((skill) => (
                <SelectItem key={skill.id} value={skill.id}>
                  {skill.name}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectSeparator />
          </>
        )}
        <SelectGroup>
          {leading.length > 0 && <SelectLabel>Other skills</SelectLabel>}
          {rest.map((skill) => (
            <SelectItem key={skill.id} value={skill.id}>
              {skill.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
