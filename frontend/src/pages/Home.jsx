import { useState } from "react"
import AnimatedList from "../components/AnimatedList/AnimatedList"
import BubbleMenu from "../components/BubbleMenu/BubbleMenu"
import "../components/AnimatedList/AnimatedList.css"
import "../components/BubbleMenu/BubbleMenu.css"

export default function Home() {
  // List items
  const listItems = [
    "Item 1",
    "Item 2",
    "Item 3",
    "Item 4",
    "Item 5",
    "Item 6",
    "Item 7",
    "Item 8",
    "Item 9",
    "Item 10"
  ]

  // BubbleMenu items
  const menuItems = [
    { label: "home", href: "#", ariaLabel: "Home", rotation: -8, hoverStyles: { bgColor: "#3b82f6", textColor: "#ffffff" } },
    { label: "about", href: "#", ariaLabel: "About", rotation: 8, hoverStyles: { bgColor: "#10b981", textColor: "#ffffff" } },
    { label: "projects", href: "#", ariaLabel: "Projects", rotation: 8, hoverStyles: { bgColor: "#f59e0b", textColor: "#ffffff" } },
    { label: "blog", href: "#", ariaLabel: "Blog", rotation: 8, hoverStyles: { bgColor: "#ef4444", textColor: "#ffffff" } },
    { label: "contact", href: "#", ariaLabel: "Contact", rotation: -8, hoverStyles: { bgColor: "#8b5cf6", textColor: "#ffffff" } }
  ]

  const handleSelectItem = (item, index) => {
    console.log("Selected item:", item, index)
  }

  return (
    <div className="home-page">
      {/* BubbleMenu */}
      <BubbleMenu
        logo={<span style={{ fontWeight: 700 }}>RB</span>}
        items={menuItems}
        menuAriaLabel="Toggle navigation"
        menuBg="#ffffff"
        menuContentColor="#111111"
        useFixedPosition={false}
        animationEase="back.out(1.5)"
        animationDuration={0.5}
        staggerDelay={0.12}
      />

      {/* Animated List */}
      <div style={{ marginTop: "150px", display: "flex", justifyContent: "center" }}>
        <AnimatedList
          items={listItems}
          onItemSelect={handleSelectItem}
          showGradients
          enableArrowNavigation
          displayScrollbar
        />
      </div>
    </div>
  )
}
