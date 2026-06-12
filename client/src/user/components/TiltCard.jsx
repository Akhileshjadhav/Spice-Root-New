import { useEffect, useRef } from "react";

function TiltCard({
  className = "",
  children,
  maxTilt = 10,
  scale = 1.016,
  ...props
}) {
  const elementRef = useRef(null);
  const frameRef = useRef(0);
  const nextTransformRef = useRef("");
  const isInteractiveRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const hoverQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const updateInteractivity = () => {
      isInteractiveRef.current = hoverQuery.matches && !reducedMotionQuery.matches;
    };

    updateInteractivity();

    hoverQuery.addEventListener("change", updateInteractivity);
    reducedMotionQuery.addEventListener("change", updateInteractivity);

    return () => {
      window.cancelAnimationFrame(frameRef.current);
      hoverQuery.removeEventListener("change", updateInteractivity);
      reducedMotionQuery.removeEventListener("change", updateInteractivity);
    };
  }, []);

  const applyTransform = () => {
    const element = elementRef.current;

    if (!element) {
      return;
    }

    element.style.transform = nextTransformRef.current;
    frameRef.current = 0;
  };

  const queueTransform = (transform) => {
    nextTransformRef.current = transform;

    if (!frameRef.current) {
      frameRef.current = window.requestAnimationFrame(applyTransform);
    }
  };

  const handlePointerMove = (event) => {
    if (!isInteractiveRef.current) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    event.currentTarget.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
    queueTransform(
      `perspective(1200px) rotateX(${(y * -maxTilt).toFixed(2)}deg) rotateY(${(
        x * maxTilt
      ).toFixed(2)}deg) translateY(-4px) scale(${scale})`
    );
  };

  const handlePointerLeave = (event) => {
    event.currentTarget.style.removeProperty("--pointer-x");
    event.currentTarget.style.removeProperty("--pointer-y");
    queueTransform("perspective(1200px) rotateX(0deg) rotateY(0deg) translateY(0) scale(1)");
  };

  return (
    <div
      ref={elementRef}
      className={className}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      {...props}
    >
      {children}
    </div>
  );
}

export default TiltCard;
