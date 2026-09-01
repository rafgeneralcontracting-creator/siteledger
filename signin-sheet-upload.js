// Allow sign-in sheets to be either photographed or uploaded from the device.
(() => {
  window.slScanSignInForm = function () {
    closeModal();
    modal(`<h2>Sign-In Sheet</h2>
      <div class="small" style="margin-bottom:14px">Take a new photo or upload an existing image of the sign-in sheet. SiteLedger will read it, then you review everything before it is added.</div>
      <div class="field">
        <label>Sign-In Sheet Image</label>
        <input id="sl_scan_file" type="file" accept="image/*">
        <div class="small" style="margin-top:6px">On a phone you can choose Camera, Photo Library, or Files.</div>
      </div>
      <div id="sl_scan_status" class="small"></div>
      <div class="actions"><button class="btn secondary" onclick="closeModal()">Cancel</button><button id="sl_scan_btn" class="btn primary" onclick="slReadSignInSheet()">Read Sheet</button></div>`);
  };
})();
