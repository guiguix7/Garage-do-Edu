document.addEventListener("DOMContentLoaded", () => {
    const internalLinks = document.querySelectorAll('a[href^="#"]');
    const headerTop = document.querySelector(".header-top");

    const getOffset = () => {
        const topHeight = headerTop ? headerTop.offsetHeight : 0;
        const secondaryHeader = document.querySelector(".backgrond-header");
        const secondaryHeight = secondaryHeader ? secondaryHeader.offsetHeight * 0.25 : 0;
        return topHeight + secondaryHeight + 24;
    };

    const scrollToTarget = (targetId) => {
        const target = document.querySelector(targetId);
        if (!target) {
            return;
        }

        const offset = getOffset();
        const topPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;

        window.scrollTo({
            top: Math.max(topPosition, 0),
            behavior: "smooth"
        });
    };

    internalLinks.forEach((link) => {
        link.addEventListener("click", (event) => {
            const href = link.getAttribute("href");
            if (!href || href === "#") {
                return;
            }

            event.preventDefault();
            scrollToTarget(href);
            history.pushState(null, "", href);
        });
    });

    if (window.location.hash) {
        window.requestAnimationFrame(() => {
            scrollToTarget(window.location.hash);
        });
    }
});
