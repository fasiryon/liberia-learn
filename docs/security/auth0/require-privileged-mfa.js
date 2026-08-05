/**
 * Auth0 Post Login Action for the dedicated LiberiaLearn privileged app.
 * Configure LIBERIALEARN_CLIENT_ID as an Action secret.
 */
exports.onExecutePostLogin = async (event, api) => {
  if (event.client.client_id !== event.secrets.LIBERIALEARN_CLIENT_ID) return;
  api.multifactor.enable("any", { allowRememberBrowser: false });
};
