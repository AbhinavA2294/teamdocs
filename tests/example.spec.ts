import { test, expect } from "@playwright/test";

test("TeamDocs loads successfully", async ({ page }) => {
  await page.goto("http://localhost:3000");

  await expect(
    page.getByRole("heading", {
      name: "TeamDocs",
      exact: true,
    })
  ).toBeVisible();

  // Either the login page or the authenticated
  // document workspace should be displayed.
  await expect(
    page
      .getByRole("button", { name: "Sign In" })
      .or(page.getByRole("button", { name: "+ New Document" }))
  ).toBeVisible();
});

test("TeamDocs shows authentication form", async ({ page }) => {
  await page.goto("http://localhost:3000");

  await expect(
    page.getByRole("heading", {
      name: "TeamDocs",
      exact: true,
    })
  ).toBeVisible();

  await expect(
    page.getByRole("textbox", { name: "Email" })
  ).toBeVisible();

  await expect(
    page.getByLabel("Password")
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: "Sign In" })
  ).toBeVisible();
});