function ActionButton({ children, variant = "secondary", className = "", ...props }) {
  return (
    <button
      type="button"
      className={`admin-${variant}-button${className ? ` ${className}` : ""}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default ActionButton;
