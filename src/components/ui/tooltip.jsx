import React from "react";
import { createPortal } from "react-dom";

const cn = (...classes) => classes.filter(Boolean).join(" ");

export const Tooltip = ({
  content,
  children,
  className,
  disabled = false,
  side = "top",
  ...props
}) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const [coords, setCoords] = React.useState({ top: 0, left: 0, arrowLeft: 0, measured: false });
  const triggerRef = React.useRef(null);
  const tooltipRef = React.useRef(null);

  React.useLayoutEffect(() => {
    if (!isVisible) {
      setCoords({ top: 0, left: 0, arrowLeft: 0, measured: false });
      return;
    }

    const updatePosition = () => {
      if (triggerRef.current && tooltipRef.current) {
        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const tooltipWidth = tooltipRect.width || 120;
        const tooltipHeight = tooltipRect.height || 32;

        const centerLeft = triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2;
        const minLeft = 8;
        const maxLeft = window.innerWidth - tooltipWidth - 8;
        const clampedLeft = Math.max(minLeft, Math.min(maxLeft, centerLeft));

        const triggerCenter = triggerRect.left + triggerRect.width / 2;
        const arrowLeft = triggerCenter - clampedLeft;

        const topPosition = side === "bottom"
          ? triggerRect.bottom + 10
          : triggerRect.top - tooltipHeight - 10;

        setCoords({
          top: topPosition,
          left: clampedLeft,
          arrowLeft: arrowLeft,
          measured: true,
        });
      }
    };

    updatePosition();
    
    // Set up window resize listener
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [isVisible, content, side]);

  if (!children) return null;

  // Bind ref and events to trigger child
  const trigger = React.cloneElement(children, {
    ref: triggerRef,
    onMouseEnter: (e) => {
      children.props.onMouseEnter?.(e);
      if (!disabled) setIsVisible(true);
    },
    onMouseLeave: (e) => {
      children.props.onMouseLeave?.(e);
      setIsVisible(false);
    },
    onFocus: (e) => {
      children.props.onFocus?.(e);
      if (!disabled) setIsVisible(true);
    },
    onBlur: (e) => {
      children.props.onBlur?.(e);
      setIsVisible(false);
    },
  });

  return (
    <>
      {trigger}
      {isVisible && createPortal(
        <div
          ref={tooltipRef}
          style={{
            position: "fixed",
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            opacity: coords.measured ? 1 : 0,
          }}
          className={cn(
            "z-[9999] whitespace-nowrap rounded-md border border-[#333333] bg-[#1F2023] px-3 py-1.5 text-xs font-medium text-white shadow-[0_4px_12px_rgba(0,0,0,0.5)] pointer-events-none select-none transition-opacity duration-100 ease-out",
            className
          )}
          role="tooltip"
          {...props}
        >
          {content}
          {side === "bottom" ? (
            <>
              {/* Arrow border pointing up */}
              <div 
                className="absolute bottom-full border-x-4 border-x-transparent border-b-4 border-b-[#333333] -translate-x-1/2"
                style={{ left: `${coords.arrowLeft}px` }}
              />
              {/* Arrow inner pointing up */}
              <div 
                className="absolute bottom-full border-x-[3px] border-x-transparent border-b-[3px] border-b-[#1F2023] -translate-x-1/2" 
                style={{ left: `${coords.arrowLeft}px`, marginBottom: '-1px' }} 
              />
            </>
          ) : (
            <>
              {/* Arrow border pointing down */}
              <div 
                className="absolute top-full border-x-4 border-x-transparent border-t-4 border-t-[#333333] -translate-x-1/2"
                style={{ left: `${coords.arrowLeft}px` }}
              />
              {/* Arrow inner pointing down */}
              <div 
                className="absolute top-full border-x-[3px] border-x-transparent border-t-[3px] border-t-[#1F2023] -translate-x-1/2" 
                style={{ left: `${coords.arrowLeft}px`, marginTop: '-1px' }} 
              />
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
};

export default Tooltip;
