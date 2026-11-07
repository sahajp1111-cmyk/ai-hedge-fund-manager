import { test, expect } from "@playwright/test";
test("Workspace loads real API status, all views navigate, and mobile layout stays within viewport", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("API connected", { exact: false })).toBeVisible();
  await expect(
    page.getByText("Configured universe", { exact: true }),
  ).toBeVisible();
  for (const title of [
    "Market radar",
    "Research queue",
    "Evidence",
    "Portfolio",
    "Notifications",
  ]) {
    await page.getByRole("button", { name: title, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: test.info().outputPath("workspace.png"),
    fullPage: true,
  });
});
