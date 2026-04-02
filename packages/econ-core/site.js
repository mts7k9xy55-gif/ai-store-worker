(() => {
  const config = window.ECON_CONFIG || {};
  const checkoutUrl = config.checkoutUrl || "#";
  const supportEmail = config.supportEmail || "";
  const checkoutMode = config.checkoutMode || "unknown";

  document.querySelectorAll("[data-checkout-link]").forEach((element) => {
    element.setAttribute("href", checkoutUrl);
  });

  document.querySelectorAll("[data-checkout-mode]").forEach((element) => {
    element.textContent = checkoutMode;
  });

  document.querySelectorAll("[data-support-mail]").forEach((element) => {
    if (!supportEmail) {
      return;
    }
    const subject = element.getAttribute("data-subject") || "Econ support request";
    element.setAttribute("href", `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}`);
  });
})();
