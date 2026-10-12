export function el(tag, options = {}, children = []) {
    const element = document.createElement(tag);
    if (options.class)
        element.className = options.class;
    if (options.text !== undefined)
        element.textContent = options.text;
    if (options.attrs) {
        Object.entries(options.attrs).forEach(([name, value]) => {
            element.setAttribute(name, value);
        });
    }
    children.forEach((child) => element.append(child));
    return element;
}
export function formatClock(date = new Date()) {
    return date.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}
export function setMessage(target, text, kind) {
    if (!target)
        return;
    target.textContent = text;
    target.className = kind ? `form-message ${kind}` : "form-message";
}
