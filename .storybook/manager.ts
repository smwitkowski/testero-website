import { addons } from "@storybook/manager-api";
import { create } from "@storybook/theming/create";

const theme = create({
  base: "light",
  brandTitle: "Testero Design System",
});

addons.setConfig({
  theme,
});
