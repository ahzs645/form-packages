/**
 * UserProfile Component
 * Select an active user. Parameters are the same as FindCode.
 */

import React from 'react';
import { FindCode, FindCodeProps } from '../controls/FindCode';

/** Coding type for values */
export interface Coding {
  code?: string;
  display?: string;
  system?: string;
}

/** User profile data from source */
export interface UserProfileData {
  userProfileId: number | string;
  identity: {
    fullName: string;
  };
}

export interface UserProfileProps {
  /** Default value for control */
  defaultValue?: Coding;
  /** Active data field name where selection is stored */
  fieldId?: string;
  /** Descriptive label for the control */
  label?: string;
  /** Show or update */
  readOnly?: boolean;
  /** Is control required? */
  required?: boolean;
  /** Override props for the underlying FindCode control */
  findCodeProps?: Partial<FindCodeProps>;
  /** User profiles to select from (if not provided, will use source data) */
  userProfiles?: UserProfileData[];
}

/**
 * UserProfile - A pre-configured FindCode for user selection.
 * This is a thin wrapper around FindCode with user profiles as the option list.
 */
export const UserProfile: React.FC<UserProfileProps> = ({
  fieldId = 'userProfile',
  label = 'User Profile',
  defaultValue,
  readOnly,
  required,
  findCodeProps = {},
  userProfiles = [],
}) => {
  // Map user profiles to option list format {code, display}
  const optionList = userProfiles.map((profile) => ({
    code: String(profile.userProfileId),
    display: profile.identity.fullName,
  }));

  return (
    <FindCode
      fieldId={fieldId}
      label={label}
      optionList={optionList}
      defaultValue={defaultValue as any}
      readOnly={readOnly}
      required={required}
      {...findCodeProps}
    />
  );
};

export default UserProfile;
