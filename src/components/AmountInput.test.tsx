/**
 * @jest-environment jsdom
 */
// Sesión J.1.19: regresión de decimales en el monto de un gasto. El bug real
// era `inputMode="numeric"` — en iOS ese modo muestra el teclado tipo-teléfono
// (sin tecla "," ni "."), así que un usuario real nunca podía tipear un
// decimal aunque la lógica de parseo (probada abajo) siempre haya sido
// correcta. Este test falla si alguien vuelve a poner `inputMode="numeric"`.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import AmountInput from "./AmountInput";

// @ts-expect-error - flag que react-dom espera en jsdom para envolver renders/unmounts en act()
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("AmountInput", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function getInput(): HTMLInputElement {
    return container.querySelector("input") as HTMLInputElement;
  }

  function setNativeValue(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  test('usa inputMode="decimal" (no "numeric") para que iOS muestre la tecla de decimal', () => {
    act(() => {
      root.render(<AmountInput value="" onChange={() => {}} />);
    });
    expect(getInput().getAttribute("inputMode")).toBe("decimal");
  });

  test("acepta coma como separador decimal y la normaliza a punto", () => {
    let current = "";
    const onChange = (raw: string) => {
      current = raw;
    };
    act(() => {
      root.render(<AmountInput value={current} onChange={onChange} />);
    });
    act(() => setNativeValue(getInput(), "1234,56"));
    expect(current).toBe("1234.56");
  });

  test("acepta punto como separador decimal", () => {
    let current = "";
    const onChange = (raw: string) => {
      current = raw;
    };
    act(() => {
      root.render(<AmountInput value={current} onChange={onChange} />);
    });
    act(() => setNativeValue(getInput(), "1234.56"));
    expect(current).toBe("1234.56");
  });

  test("limita a 2 decimales y a un único separador", () => {
    let current = "";
    const onChange = (raw: string) => {
      current = raw;
    };
    act(() => {
      root.render(<AmountInput value={current} onChange={onChange} />);
    });
    act(() => setNativeValue(getInput(), "1.234.567"));
    expect(current).toBe("1.23");
  });
});
