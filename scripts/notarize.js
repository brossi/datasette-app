/* Based on https://kilianvalkhof.com/2019/electron/notarizing-your-electron-application/ */

const { notarize } = require("@electron/notarize");

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== "darwin") {
    return;
  }

  // Skip notarization unless credentials are present (e.g. local dev builds).
  if (!process.env.APPLEID) {
    console.log("Skipping notarization: APPLEID is not set");
    return;
  }

  // notarytool requires a Team ID. Fail clearly here rather than letting the
  // notarize call fail deep inside Apple's tooling with an opaque message.
  if (!process.env.APPLE_TEAM_ID) {
    throw new Error(
      "Notarization requires APPLE_TEAM_ID to be set (alongside APPLEID / " +
        "APPLEIDPASS). Set it to your Apple Developer Team ID, or unset APPLEID " +
        "to skip notarization for a local build."
    );
  }

  const appName = context.packager.appInfo.productFilename;

  // @electron/notarize v2+ uses Apple's notarytool, which requires a teamId.
  return await notarize({
    tool: "notarytool",
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLEID,
    appleIdPassword: process.env.APPLEIDPASS,
    teamId: process.env.APPLE_TEAM_ID,
  });
};
