const storedLanguage = localStorage.getItem("i18nextLng") || "en-US";

if (storedLanguage.toLowerCase().startsWith("en")) {
  const targetLocale = "en-US";
  const bubbleSelector = ".bubble, .bubble-left, .bubble-right";
  const textAttributes = ["placeholder", "title", "aria-label"];
  const replacementMap = new Map([
    ["copiado para a area de transferencia", "Copied to clipboard"],
    ["deseja realmente sair?", "Do you really want to sign out?"],
    ["cancelar", "Cancel"],
    ["sair", "Sign out"],
    ["hoje", "Today"],
    ["ontem", "Yesterday"],
    ["voce", "You"],
    ["nenhuma instancia selecionada", "No instance selected"],
    ["token, instancename e apiurl sao obrigatorios", "Token, instanceName, and apiUrl are required"],
    ["instancia nao encontrada", "Instance not found"],
    ["erro ao validar token ou buscar instancia", "Error validating token or loading instance"],
    ["natureza", "Nature"],
    ["comida", "Food"],
    ["atividades", "Activities"],
    ["viagem", "Travel"],
    ["objetos", "Objects"],
    ["simbolos", "Symbols"],
    ["contatos", "Contacts"],
    ["grupos", "Groups"],
    ["enviar mensagem...", "Send message..."],
    ["enviar", "Send"],
    ["carregando...", "Loading..."],
    ["nenhum resultado encontrado!", "No results found!"],
    ["erro ao buscar chats", "Error loading chats"],
  ]);

  const normalizeText = (value) =>
    String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const translateText = (value) => {
    const translated = replacementMap.get(normalizeText(value));
    return translated || value;
  };

  const isPortugueseLocale = (value) => {
    if (Array.isArray(value)) {
      return value.some(isPortugueseLocale);
    }

    return typeof value === "string" && value.toLowerCase() === "pt-br";
  };

  const normalizeLocales = (value) => {
    if (value == null) {
      return targetLocale;
    }

    return isPortugueseLocale(value) ? targetLocale : value;
  };

  const wrapIntlConstructor = (OriginalConstructor) =>
    new Proxy(OriginalConstructor, {
      apply(target, thisArg, args) {
        return Reflect.apply(target, thisArg, [normalizeLocales(args[0]), args[1]]);
      },
      construct(target, args, newTarget) {
        return Reflect.construct(
          target,
          [normalizeLocales(args[0]), args[1]],
          newTarget || target,
        );
      },
    });

  Intl.NumberFormat = wrapIntlConstructor(Intl.NumberFormat);
  Intl.DateTimeFormat = wrapIntlConstructor(Intl.DateTimeFormat);

  const originalToLocaleDateString = Date.prototype.toLocaleDateString;
  Date.prototype.toLocaleDateString = function patchedToLocaleDateString(locales, options) {
    return originalToLocaleDateString.call(this, normalizeLocales(locales), options);
  };

  const shouldSkipElement = (element) => {
    if (!element) {
      return true;
    }

    return Boolean(element.closest(bubbleSelector));
  };

  const translateElementAttributes = (element) => {
    if (shouldSkipElement(element)) {
      return;
    }

    for (const attributeName of textAttributes) {
      if (!element.hasAttribute(attributeName)) {
        continue;
      }

      const currentValue = element.getAttribute(attributeName);
      const translatedValue = translateText(currentValue);

      if (translatedValue !== currentValue) {
        element.setAttribute(attributeName, translatedValue);
      }
    }
  };

  const translateTextNode = (node) => {
    const parent = node.parentElement;

    if (!parent || shouldSkipElement(parent)) {
      return;
    }

    const currentValue = node.nodeValue;
    const translatedValue = translateText(currentValue);

    if (translatedValue !== currentValue) {
      node.nodeValue = translatedValue;
    }
  };

  const translateTree = (root) => {
    if (!root) {
      return;
    }

    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root);
      return;
    }

    if (root.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    translateElementAttributes(root);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let currentNode = walker.nextNode();

    while (currentNode) {
      translateTextNode(currentNode);
      currentNode = walker.nextNode();
    }

    if (root.querySelectorAll) {
      for (const element of root.querySelectorAll("*")) {
        translateElementAttributes(element);
      }
    }
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        translateTextNode(mutation.target);
        continue;
      }

      if (mutation.type === "attributes") {
        translateElementAttributes(mutation.target);
        continue;
      }

      for (const addedNode of mutation.addedNodes) {
        translateTree(addedNode);
      }
    }
  });

  const start = () => {
    document.documentElement.lang = targetLocale;
    translateTree(document.body);
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: textAttributes,
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}