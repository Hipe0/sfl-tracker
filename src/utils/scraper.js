export async function fetchFarmFromSFLWorld(farmId) {
  // Use Vite's local proxy to bypass CORS
  const proxyUrl = `/sfl-proxy/land/${farmId}/chapter`;

  try {
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error("Failed to fetch page");
    // Since we fetch directly, we get the HTML text back
    const htmlString = await res.text();
    
    // Use the native browser DOMParser to convert HTML string to a DOM document
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    // SCrape Chores
    const chores = [];
    // Select all the chore item wrappers in the HTML
    const choreElements = doc.querySelectorAll('#collapseChores .badge');
    
    choreElements.forEach((el, index) => {
      // Find the title element
      const titleEl = el.querySelector('.mb-auto.h6.text-wrap');
      if (!titleEl) return;
      const title = titleEl.textContent.trim();
      
      // Find the progress element
      const rightPanel = el.querySelector('.ta-right');
      let completed = 0, total = 1, reward = 0;
      
      if (rightPanel) {
        // Extract completed and total from specific tags
        const smallEl = rightPanel.querySelector('small');
        const bEl = rightPanel.querySelector('b');
        
        if (smallEl && bEl) {
          completed = parseInt(smallEl.textContent.replace(/[^0-9]/g, '')) || 0;
          total = parseInt(bEl.textContent.replace(/[^0-9]/g, '')) || 1;
        } else {
          // Fallback if structure is different
          completed = parseInt(rightPanel.textContent.replace(/[^0-9]/g, '')) || 0;
          total = completed;
        }
        
        // Extract reward (it's in the last div next to an image)
        const divs = rightPanel.querySelectorAll('div > div');
        if (divs.length > 0) {
          const lastDiv = divs[divs.length - 1];
          reward = parseInt(lastDiv.textContent.replace(/[^0-9]/g, '')) || 0;
        }
      }
      
      chores.push({
        id: index,
        name: title,
        completed,
        total,
        reward,
        status: completed >= total ? 'completed' : (completed > 0 ? 'in-progress' : 'pending')
      });
    });

    // We can also scrape level and coins if they exist on the page
    // For now we'll just return the chores to the app
    return {
      success: true,
      chores: chores.length > 0 ? chores : null
    };
  } catch (error) {
    console.error("Scraping error:", error);
    return {
      success: false,
      error: error.message
    };
  }
}
