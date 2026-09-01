import { Button, Field, Input } from "@webforms/cerner-terra";
import React from "react";

/** Renders real (vendored) Terra components — proves the fork runs on React 19. */
export const TerraProbe: React.FC = () => (
  <div style={{ padding: 12 }}>
    <Field label="Reason for visit" required htmlFor="probe-input" help="Real Terra Field">
      <Input id="probe-input" defaultValue="" />
    </Field>
    <Button text="Terra Button" variant="emphasis" />
  </div>
);
