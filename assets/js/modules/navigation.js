export function setupNavigation() {
  const selector = document.querySelector('.selettore');
  const tabs = ['.noi', '.home', '.umore']
    .map(query => document.querySelector(query))
    .filter(Boolean);

  if (!selector || tabs.length === 0) return;

  function selectTab(selectedTab) {
    tabs.forEach(tab => tab.classList.toggle('active', tab === selectedTab));

    const center = selectedTab.offsetLeft + selectedTab.offsetWidth / 2;
    const selectorCenter = selector.offsetWidth / 2;
    const position = center - selectorCenter;

    selector.style.transform = `translateX(${position}px) scaleX(0.78) scaleY(0.68)`;
    window.setTimeout(() => {
      selector.style.transform = `translateX(${position}px) scaleX(1) scaleY(1)`;
    }, 100);
  }

  tabs.forEach(tab => tab.addEventListener('click', () => selectTab(tab)));
  const homeTab = document.querySelector('.home');
  if (homeTab) selectTab(homeTab);
}
