function mark(modality: 'pointer' | 'keyboard') {
  document.documentElement.dataset.input = modality;
}

export function trackInputModality() {
  mark('pointer');

  document.addEventListener('pointerdown', () => mark('pointer'), true);

  document.addEventListener(
    'keydown',
    (event) => {
      if (event.metaKey || event.altKey || event.ctrlKey) {
        return;
      }

      mark('keyboard');
    },
    true,
  );
}
