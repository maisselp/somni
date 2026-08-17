// State
let currentLang = localStorage.getItem('maisse_lang');
if (!['es', 'ca', 'en'].includes(currentLang)) {
    const browserLang = navigator.language.slice(0, 2);
    currentLang = ['es', 'ca', 'en'].includes(browserLang) ? browserLang : 'en';
}

let textSizeLevels = ['normal', 'large', 'xl'];
let currentTextSize = localStorage.getItem('maisse_text_size') || 'normal';

function getDynamicText(type) {
    const sizeMap = {
        'caption': ['text-base lg:text-sm', 'text-lg lg:text-base', 'text-xl lg:text-lg'],
        'body': ['text-lg lg:text-base', 'text-xl lg:text-lg', 'text-2xl lg:text-xl'],
        'lead': ['text-xl lg:text-lg', 'text-2xl lg:text-xl', 'text-3xl lg:text-2xl'],
        'manifesto': ['text-lg lg:text-xl', 'text-xl lg:text-2xl', 'text-2xl lg:text-3xl'],
        'label': ['text-base', 'text-lg', 'text-xl']
    };
    const idx = textSizeLevels.indexOf(currentTextSize);
    return sizeMap[type][idx >= 0 ? idx : 0];
}

let isMenuOpen = false;
let lightboxState = {
    isOpen: false,
    photos: [],
    currentIndex: 0,
    playing: false,
    audio: null
};

let playingExternalId = null;
let externalAudio = null;
let privacyModalOpen = false;
let privacyOpenedFromCheckbox = false;
let lightboxTextVisible = true;

// Cookie helpers
function setCookie(name, value, hours) {
    const expires = new Date(Date.now() + hours * 36e5).toUTCString();
    document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}
function getCookie(name) {
    return document.cookie.split('; ').reduce((acc, part) => {
        const [k, v] = part.split('=');
        return k === name ? v : acc;
    }, null);
}

// If the user has read the privacy policy in the last 4 hours, remember it
let privacyRead = getCookie('maisse_privacy_read') === '1';

// Main render function
function renderApp() {
    // Preserve form state before DOM replacement
    const formNameEl = document.getElementById('cf-nombre');
    let savedForm = null;
    if (formNameEl) {
        savedForm = {
            nombre: formNameEl.value,
            email: document.getElementById('cf-email').value,
            telefono: document.getElementById('cf-telefono').value,
            motivo: document.getElementById('cf-motivo').value,
            mensaje: document.getElementById('cf-mensaje').value,
            consent: document.getElementById('cf-consent') ? document.getElementById('cf-consent').checked : false
        };
    }

    const t = window.translations[currentLang];
    const appRoot = document.getElementById('app');

    // ── Helpers de visibilidad (compatibles con data.js antiguo sin pageSections/sections) ──
    const pageSections = t.pageSections || [
        { id: 'hero', visible: true, order: 1 },
        { id: 'manifesto', visible: true, order: 2 },
        { id: 'gallery', visible: true, order: 3 },
        { id: 'author', visible: true, order: 4 },
        { id: 'credits', visible: true, order: 5 },
        { id: 'contact', visible: true, order: 6 },
    ];
    const gallerySections = t.sections || [
        { id: 'urban', title: t.labels ? t.labels.urban_space : 'Urbano', visible: true, order: 1 },
        { id: 'indoor', title: t.labels ? t.labels.indoor_space : 'Interior', visible: true, order: 2 },
    ];

    const isPageSectionVisible = (id) => {
        const sec = pageSections.find(s => s.id === id);
        return !sec || sec.visible !== false;
    };
    const isGallerySectionVisible = (secId) => {
        const sec = gallerySections.find(s => s.id === secId);
        return !sec || sec.visible !== false;
    };

    // ── Build Rooms HTML (respetando visibilidad en cascada) ──
    // Una room es visible si: su propia visible !== false, su gallerySec es visible, y la page 'gallery' es visible
    const galleryPageVisible = isPageSectionVisible('gallery');

    // Función para renderizar una room individual
    function buildRoomHtml(room) {
        let photosHtml = room.photos.map((photo, pIndex) => {
            let layoutVars = { col: '', aspect: 'aspect-[4/5]' };
            if (photo.isMasterpiece) {
                if (photo.orientation === 'portrait') {
                    layoutVars.col = 'md:col-span-1 md:row-span-2';
                    layoutVars.aspect = 'aspect-[2/3] h-full min-h-[60vh] md:min-h-0';
                } else {
                    layoutVars.col = 'md:col-span-2';
                    layoutVars.aspect = 'aspect-[3/2]';
                }
            } else {
                if (photo.orientation === 'landscape') {
                    layoutVars.col = '';
                    layoutVars.aspect = 'aspect-[4/3] lg:aspect-[3/2]';
                } else {
                    layoutVars.col = '';
                    layoutVars.aspect = 'aspect-[2/3]';
                }
            }
            return `
            <div
                class="group flex flex-col cursor-crosshair focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${layoutVars.col}"
                data-action="open-lightbox"
                data-room-id="${room.id}"
                data-photo-id="${photo.id}"
                tabindex="0"
            >
                <div class="overflow-hidden bg-zinc-900 mb-4 flex-grow relative rounded-sm ${layoutVars.aspect} pointer-events-none">
                    <img src="${photo.url}" alt="${photo.title}" loading="lazy" class="w-full h-full absolute inset-0 object-cover transition-transform duration-700 group-hover:scale-105 pointer-events-auto">
                    ${photo.audioUrl ? `
                    <button data-action="play-external-audio" data-photo-id="${photo.id}" class="absolute top-4 right-4 z-10 bg-black/60 rounded-full p-2 backdrop-blur-sm border border-white/20 flex items-center gap-2 pointer-events-auto hover:bg-black/80 transition-colors">
                        <i data-feather="${playingExternalId === photo.id ? 'pause' : 'play'}" class="w-3 h-3 text-white fill-white stroke-white"></i>
                        <span class="text-white text-[10px] font-mono pr-1 tracking-widest uppercase md:inline hidden">${t.nav.audioguia}</span>
                    </button>
                    ` : ''}
                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-6 pointer-events-none">
                        <p class="text-sm font-mono tracking-wider text-white">${photo.year}</p>
                    </div>
                </div>
                <p class="text-white/60 ${getDynamicText('caption')} italic pointer-events-none">${photo.description}</p>
            </div>`;
        }).join('');

        const sectionId = room.sectionId || (room.id.startsWith('urban') ? 'urban' : 'indoor');
        const sectionLabel = (() => {
            const sec = gallerySections.find(s => s.id === sectionId);
            if (sec) return sec.title;
            return sectionId === 'urban' ? (t.labels ? t.labels.urban_space : 'Espacio Urbano') : (t.labels ? t.labels.indoor_space : 'Espacio Interior');
        })();

        return `
        <section id="${room.id}" class="min-h-screen py-24 px-6 lg:px-24 flex flex-col justify-center border-t border-white/5">
            <div class="max-w-7xl mx-auto w-full">
                <div class="mb-16 fade-in">
                    <span class="font-mono ${getDynamicText('label')} uppercase text-accent mb-4 block">${sectionLabel}</span>
                    <h2 class="font-display text-5xl lg:text-8xl py-1 uppercase mb-6 tracking-tight">${room.title}</h2>
                    ${room.audioUrl ? `
                    <button data-action="play-external-audio" data-id="${room.id}" data-audio-url="${room.audioUrl}" class="bg-black/60 rounded-full px-4 py-2 border border-white/20 inline-flex items-center gap-3 hover:bg-white/10 transition-colors mb-6">
                        <i data-feather="${playingExternalId === room.id ? 'pause' : 'play'}" class="w-4 h-4 text-white fill-white stroke-white"></i>
                        <span class="text-white text-xs font-mono tracking-widest uppercase">${t.nav.audioguia}</span>
                    </button>
                    ` : ''}
                    <p class="w-full ${getDynamicText('lead')} text-white/80 font-light leading-relaxed mb-6">${room.description}</p>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12 grid-flow-row-dense fade-in">
                    ${photosHtml}
                </div>
            </div>
        </section>`;
    }

    // Construir roomsHtml agrupado por sección (con pausa intermedia y respeto de visibilidad)
    let roomsHtml = '';
    if (galleryPageVisible) {
        const visibleSections = gallerySections.filter(s => isGallerySectionVisible(s.id));
        visibleSections.forEach((sec, secIdx) => {
            const secRooms = t.rooms.filter(r => {
                const rSec = r.sectionId || (r.id.startsWith(sec.id) ? sec.id : null);
                return rSec === sec.id && r.visible !== false;
            });
            secRooms.forEach((room, roomIdx) => {
                roomsHtml += buildRoomHtml(room);
                // Pausa entre el último room de la sección N y la sección N+1
                const isLastInSection = roomIdx === secRooms.length - 1;
                const hasNextSection = secIdx < visibleSections.length - 1;
                if (isLastInSection && hasNextSection && t.pauses.pause1_visible !== false) {
                    roomsHtml += `<div class="py-24 lg:py-48 px-6 text-center border-t border-white/5"><div class="max-w-3xl mx-auto"><span class="font-mono text-accent ${getDynamicText('label')} tracking-widest uppercase mb-8 block">${t.pauses.title}</span><p class="font-display text-3xl lg:text-5xl leading-tight">"${t.pauses.pause1}"</p></div></div>`;
                }
            });
        });
        // Pausa final (después de todos los rooms)
        const totalVisibleRooms = visibleSections.reduce((n, s) => n + t.rooms.filter(r => (r.sectionId || (r.id.startsWith(s.id) ? s.id : null)) === s.id && r.visible !== false).length, 0);
        if (totalVisibleRooms > 0 && t.pauses.pause2_visible !== false) {
            roomsHtml += `<div class="py-24 lg:py-48 px-6 text-center border-t border-white/5"><div class="max-w-3xl mx-auto"><span class="font-mono text-accent ${getDynamicText('label')} tracking-widest uppercase mb-8 block">${t.pauses.title}</span><p class="font-display text-3xl lg:text-5xl leading-tight">"${t.pauses.pause2}"</p></div></div>`;
        }
    }

    appRoot.innerHTML = `
        <!-- Navigation -->
        <nav class="fixed top-0 left-0 w-full z-50 px-6 lg:px-12 py-4 md:py-6 flex justify-between items-center bg-black/70 backdrop-blur-md border-b border-white/5">
            <a href="#" class="font-display text-2xl uppercase tracking-tight text-white">${t.nav.home || 'Inicio'}</a>
            <div class="flex items-center gap-6 lg:gap-8 text-white">
                <button data-action="toggle-text-size" class="text-white/80 hover:text-white transition-colors" title="Tamaño de texto">
                    <i data-feather="type" class="w-5 h-5 lg:w-4 lg:h-4"></i>
                </button>
                <div class="hidden md:flex gap-4 font-mono text-xs tracking-widest uppercase items-center">
                    <span class="text-white/20">|</span>
                    <button data-action="set-lang" data-lang="es" class="${currentLang==='es' ? 'text-white' : 'text-white/60 hover:text-white transition-colors'}">${t.nav.lang_es}</button>
                    <button data-action="set-lang" data-lang="ca" class="${currentLang==='ca' ? 'text-white' : 'text-white/60 hover:text-white transition-colors'}">${t.nav.lang_ca}</button>
                    <button data-action="set-lang" data-lang="en" class="${currentLang==='en' ? 'text-white' : 'text-white/60 hover:text-white transition-colors'}">${t.nav.lang_en}</button>
                </div>
                <button data-action="toggle-menu" class="p-3 hover:opacity-70 transition-opacity flex items-center justify-center">
                    <i data-feather="menu"></i>
                </button>
            </div>
        </nav>

        <!-- Fullscreen Menu -->
        ${isMenuOpen ? `
        <div class="fixed inset-0 z-[100] bg-black text-white fade-in text-white/90">
            <button data-action="toggle-menu" class="absolute top-8 right-8 lg:top-12 lg:right-12 p-3 hover:rotate-90 transition-transform duration-300">
                <i data-feather="x" class="w-8 h-8"></i>
            </button>
            <div class="w-full h-full overflow-y-auto px-6 py-24 flex flex-col">
                <div class="m-auto flex flex-col items-center w-full max-w-lg">
                    <div class="md:hidden mb-12 flex gap-6 font-mono text-sm tracking-widest uppercase">
                        <button data-action="set-lang" data-lang="es" class="${currentLang==='es' ? 'text-white' : 'text-white/60'}">${t.nav.lang_es}</button>
                        <button data-action="set-lang" data-lang="ca" class="${currentLang==='ca' ? 'text-white' : 'text-white/60'}">${t.nav.lang_ca}</button>
                        <button data-action="set-lang" data-lang="en" class="${currentLang==='en' ? 'text-white' : 'text-white/60'}">${t.nav.lang_en}</button>
                    </div>
                    <ul class="flex flex-col items-center gap-3 w-full">
                        ${pageSections.filter(s => s.visible !== false).map(ps => {
                            if (ps.id === 'gallery' && galleryPageVisible) {
                                // Agrupar rooms por sección para el menú jerárquico
                                const visibleSections = gallerySections.filter(s => isGallerySectionVisible(s.id));
                                return visibleSections.map(sec => {
                                    const secRooms = t.rooms.filter(r => {
                                        const rSec = r.sectionId || (r.id.startsWith(sec.id) ? sec.id : null);
                                        return rSec === sec.id && r.visible !== false;
                                    });
                                    if (secRooms.length === 0) return '';
                                    
                                    const sectionLink = `<li><a href="#rooms" data-action="toggle-menu" class="font-display uppercase tracking-wide hover:text-accent transition-colors text-center block text-3xl lg:text-4xl mt-6 mb-2 text-white/90">${sec.menuTitle || sec.title}</a></li>`;
                                    const roomsLinks = secRooms.map(room => `<li><a href="#${room.id}" data-action="toggle-menu" class="font-display uppercase tracking-widest hover:text-accent transition-colors text-center block text-lg lg:text-xl text-white/75 py-1">${room.menuTitle || room.title}</a></li>`).join('');
                                    return sectionLink + roomsLinks;
                                }).join('');
                            }
                            if (ps.id === 'manifesto') return `<li><a href="#manifesto" data-action="toggle-menu" class="font-display uppercase tracking-wide hover:text-accent transition-colors text-center block text-3xl lg:text-5xl mt-6">${t.nav.manifiesto}</a></li>`;
                            if (ps.id === 'map' && t.map && t.map.title) return `<li><a href="#map" data-action="toggle-menu" class="font-display uppercase tracking-wide hover:text-accent transition-colors text-center block text-3xl lg:text-5xl mt-6">${t.map.title}</a></li>`;
                            if (ps.id === 'author') return `<li><a href="#author" data-action="toggle-menu" class="font-display uppercase tracking-wide hover:text-accent transition-colors text-center block text-3xl lg:text-5xl mt-6">${t.author.menuTitle || t.author.title || t.nav.autor}</a></li>`;
                            if (ps.id === 'credits' && t.credits && t.credits.title) return `<li><a href="#credits" data-action="toggle-menu" class="font-display uppercase tracking-wide hover:text-accent transition-colors text-center block text-3xl lg:text-5xl mt-6">${t.credits.title}</a></li>`;
                            if (ps.id === 'contact') return `<li><a href="#contact" data-action="toggle-menu" class="font-display uppercase tracking-wide hover:text-accent transition-colors text-center block text-3xl lg:text-5xl mt-6">${t.nav.contacto}</a></li>`;
                            return '';
                        }).join('')}
                    </ul>
                </div>
            </div>
        </div>` : ''}

        <!-- Main Content -->
        <main>
            <!-- Hero -->
            <section class="relative h-screen flex items-center justify-center overflow-hidden">
                <div class="absolute inset-0 bg-[url('${t.hero.image || 'https://images.unsplash.com/photo-1600607686527-6fb886090705?q=80&w=2600'}')] bg-cover bg-center opacity-40"></div>
                <div class="absolute inset-0 bg-gradient-to-t from-bg via-bg/20 to-transparent"></div>
                
                <div class="relative z-10 text-center px-6">
                    <h1 class="font-display text-7xl md:text-9xl lg:text-[12rem] uppercase tracking-tight leading-none mb-6 fade-in text-white">${t.hero.title}</h1>
                    <p class="font-mono text-sm md:text-lg lg:text-2xl tracking-widest uppercase text-white/70 mx-auto fade-in">${t.hero.subtitle}</p>
                </div>
                
                <div class="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 fade-in">
                    <span class="font-mono text-xs md:text-sm lg:text-lg tracking-[0.3em] uppercase text-white/70">${t.hero.scroll}</span>
                    <div class="w-[1px] h-16 bg-gradient-to-b from-white/50 to-transparent"></div>
                </div>
            </section>

            <!-- Secciones de Página (orden y visibilidad controlados por pageSections) -->
            ${pageSections.filter(s => s.visible !== false).map(ps => {
                if (ps.id === 'manifesto') return `
            <section id="manifesto" class="py-24 lg:pt-48 lg:pb-12 px-6 border-t border-white/5">
                <div class="max-w-7xl mx-auto flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">
                    <div class="lg:w-1/4 fade-in">
                        <span class="font-mono ${getDynamicText('label')} text-accent tracking-widest uppercase mb-4 block">${t.manifesto.label}</span>
                        <h2 class="font-display text-4xl lg:text-5xl uppercase tracking-tight text-white">${t.manifesto.title}</h2>
                    </div>
                    <div class="lg:w-3/4 fade-in">
                        ${t.manifesto.audioUrl ? `
                        <button data-action="play-external-audio" data-id="manifesto" data-audio-url="${t.manifesto.audioUrl}" class="bg-black/60 rounded-full px-4 py-2 border border-white/20 inline-flex items-center gap-3 hover:bg-white/10 transition-colors mb-6">
                            <i data-feather="${playingExternalId === 'manifesto' ? 'pause' : 'play'}" class="w-4 h-4 text-white fill-white stroke-white"></i>
                            <span class="text-white text-xs font-mono tracking-widest uppercase">${t.nav.audioguia}</span>
                        </button>
                        ` : ''}
                        <p class="${getDynamicText('manifesto')} font-light leading-relaxed text-white/80 mb-6">${t.manifesto.text}</p>
                    </div>
                </div>
            </section>`;
                if (ps.id === 'gallery') return `
            <div id="rooms" class="relative z-10">${roomsHtml}</div>`;
                if (ps.id === 'map' && t.map) return `
            <section id="map" class="py-24 lg:py-32 bg-zinc-950 border-t border-white/5 relative">
                <div class="max-w-7xl mx-auto px-6 mb-12 fade-in">
                    <span class="font-mono ${getDynamicText('label')} text-accent uppercase tracking-widest mb-4 block">${t.map.label || t.map.title}</span>
                    <h2 class="font-display text-5xl lg:text-7xl uppercase mb-6 text-white">${t.map.title}</h2>
                    <p class="${getDynamicText('lead')} font-light leading-relaxed text-white/80">${t.map.description || ''}</p>
                </div>
                <div class="w-full lg:max-w-7xl lg:mx-auto lg:px-6">
                    <div class="w-full h-[60vh] min-h-[400px] lg:h-[70vh] relative fade-in lg:rounded-sm overflow-hidden border-y lg:border border-white/10 bg-zinc-900">
                        ${t.map.url ? `
                        <iframe 
                            src="${t.map.url}" 
                            width="100%" 
                            height="100%" 
                            style="border:0;" 
                            allowfullscreen="" 
                            loading="lazy" 
                            referrerpolicy="no-referrer-when-downgrade"
                            class="absolute inset-0 w-full h-full"
                        ></iframe>` : ''}
                    </div>
                </div>
            </section>`;
                if (ps.id === 'author') return `
            <section id="author" class="py-32 px-6 bg-white text-bg border-t border-white/5">
                <div class="max-w-6xl mx-auto flex flex-col md:flex-row gap-16 items-center">
                    <div class="w-full md:w-1/2 aspect-square bg-zinc-200 fade-in">
                        <img src="${t.author.image || 'https://images.unsplash.com/photo-1554046920-90dc5f3ac8ed?q=80&w=1200'}" alt="${t.author.name}" class="w-full h-full object-cover">
                    </div>
                    <div class="w-full md:w-1/2 fade-in">
                        <span class="font-mono ${getDynamicText('label')} text-accent uppercase tracking-widest mb-4 block">${t.author.title}</span>
                        <h2 class="font-display text-5xl lg:text-7xl uppercase mb-8 text-bg">${t.author.name}</h2>
                        ${t.author.audioUrl ? `
                        <button data-action="play-external-audio" data-id="author" data-audio-url="${t.author.audioUrl}" class="bg-black/10 rounded-full px-4 py-2 border border-black/20 inline-flex items-center gap-3 hover:bg-black/20 transition-colors mb-6">
                            <i data-feather="${playingExternalId === 'author' ? 'pause' : 'play'}" class="w-4 h-4 text-bg fill-bg stroke-bg"></i>
                            <span class="text-bg text-xs font-mono tracking-widest uppercase">${t.nav.audioguia}</span>
                        </button>
                        ` : ''}
                        <p class="${getDynamicText('lead')} font-light leading-relaxed text-bg/70 mb-6">${t.author.bio}</p>
                    </div>
                </div>
            </section>`;
                if (ps.id === 'credits' && t.credits) return `
            <section id="credits" class="py-24 lg:py-32 px-6 bg-zinc-900 border-t border-white/5 relative">
                <div class="max-w-5xl mx-auto fade-in">
                    <h2 class="font-display text-5xl lg:text-7xl uppercase mb-16 text-white text-center">${t.credits.title || ''}</h2>
                    <div class="credits-content text-white/80 ${getDynamicText('body')} font-light leading-relaxed">
                        ${(t.credits.html || '').replaceAll('</strong>:', '</strong>')}
                    </div>
                </div>
                <style>
                    .credits-content ul {
                        list-style: none;
                        padding: 0;
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                        row-gap: 3rem;
                        column-gap: 4rem;
                    }
                    .credits-content li {
                        display: flex;
                        flex-direction: column;
                        border-top: 1px solid rgba(255,255,255,0.05);
                        padding-top: 1rem;
                    }
                    .credits-content strong {
                        color: #ff6b6b;
                        font-family: 'JetBrains Mono', monospace;
                        font-size: 0.95em;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 0.1em;
                        margin-bottom: 0.5rem;
                        display: block;
                    }
                    .credits-content p {
                        text-align: center;
                        font-size: 1.25em;
                        font-style: italic;
                        color: rgba(255,255,255,0.6);
                        margin-bottom: 5rem;
                        max-width: 600px;
                        margin-left: auto;
                        margin-right: auto;
                        letter-spacing: 0.05em;
                    }
                </style>
            </section>`;
                return '';
            }).join('')}

            <!-- Contact -->
            <section id="contact" class="py-32 px-6 border-t border-white/5 text-white">
                <div class="max-w-3xl mx-auto fade-in">
                    <div class="text-center mb-16">
                        <span class="font-mono ${getDynamicText('label')} text-accent uppercase tracking-widest mb-4 block">${t.contact.label}</span>
                        <h2 class="font-display text-5xl lg:text-7xl uppercase mb-6 text-white">${t.contact.title}</h2>
                        <p class="text-white/70 ${getDynamicText('lead')}">${t.contact.description}</p>
                    </div>

                    <form id="contact-form" class="flex flex-col gap-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                                type="text" id="cf-nombre"
                                placeholder="${t.contact.form_name}"
                                required
                                class="bg-zinc-900 border border-white/10 text-white placeholder-white/30 px-5 py-4 font-sans ${getDynamicText('body')} focus:outline-none focus:border-accent transition-colors rounded-sm"
                            >
                            <input
                                type="email" id="cf-email"
                                placeholder="${t.contact.form_email}"
                                pattern="[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$"
                                required
                                class="bg-zinc-900 border border-white/10 text-white placeholder-white/30 px-5 py-4 font-sans ${getDynamicText('body')} focus:outline-none focus:border-accent transition-colors rounded-sm"
                            >
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                                type="tel" id="cf-telefono"
                                placeholder="${t.contact.form_phone}"
                                pattern="^(\\+|00)?[0-9\\s\\-]{9,15}$"
                                class="bg-zinc-900 border border-white/10 text-white placeholder-white/30 px-5 py-4 font-sans ${getDynamicText('body')} focus:outline-none focus:border-accent transition-colors rounded-sm"
                            >
                            <select
                                id="cf-motivo"
                                required
                                class="bg-zinc-900 border border-white/10 text-white px-5 py-4 font-sans ${getDynamicText('body')} focus:outline-none focus:border-accent transition-colors rounded-sm appearance-none cursor-pointer"
                            >
                                <option value="" disabled selected class="text-white/30">${t.contact.form_subject}</option>
                                ${t.contact.form_subject_visit ? `<option value="${t.contact.form_subject_visit}">${t.contact.form_subject_visit}</option>` : ''}
                                <option value="${t.contact.form_subject_photo}">${t.contact.form_subject_photo}</option>
                                <option value="${t.contact.form_subject_collab}">${t.contact.form_subject_collab}</option>
                                <option value="${t.contact.form_subject_web}">${t.contact.form_subject_web}</option>
                                <option value="${t.contact.form_subject_other}">${t.contact.form_subject_other}</option>
                            </select>
                        </div>
                        <textarea
                            id="cf-mensaje"
                            placeholder="${t.contact.form_message}"
                            rows="6"
                            required
                            class="bg-zinc-900 border border-white/10 text-white placeholder-white/30 px-5 py-4 font-sans ${getDynamicText('body')} focus:outline-none focus:border-accent transition-colors rounded-sm resize-none"
                        ></textarea>

                        <!-- GDPR Consent Checkbox -->
                        <div class="flex items-start gap-4 py-2">
                            <input
                                type="checkbox"
                                id="cf-consent"
                                ${privacyRead ? 'checked' : 'data-action="open-privacy"'}
                                class="mt-1 w-5 h-5 shrink-0 appearance-none border border-white/30 rounded-sm bg-zinc-900 checked:bg-accent checked:border-accent cursor-pointer transition-colors"
                            >
                            <label for="cf-consent" class="font-mono text-xs lg:text-sm tracking-wide leading-relaxed ${privacyRead ? 'text-white/80' : 'text-white/60'} transition-colors cursor-pointer">
                                ${privacyRead
                                    ? `${t.contact.form_privacy_accept.replace(t.contact.form_privacy_link, `<button type="button" data-action="open-privacy" class="underline text-accent hover:text-white transition-colors">${t.contact.form_privacy_link}</button>`)}`
                                    : `${t.contact.form_privacy_pending.replace(t.contact.form_privacy_link, `<button type="button" data-action="open-privacy" class="underline text-white/80 hover:text-accent transition-colors">${t.contact.form_privacy_link}</button>`)}`
                                }
                            </label>
                        </div>

                        <div id="cf-status" class="hidden text-center font-mono text-sm tracking-wider py-3 px-5 rounded-sm"></div>

                        <button
                            type="submit"
                            id="cf-submit"
                            ${privacyRead ? '' : 'disabled'}
                            class="mt-2 self-center px-12 py-5 border font-display uppercase tracking-widest transition-all duration-500 rounded-full ${getDynamicText('label')} ${privacyRead ? 'border-white/20 hover:bg-white hover:text-black cursor-pointer' : 'border-white/10 text-white/30 cursor-not-allowed'}"
                        >${t.contact.form_submit}</button>
                    </form>
                </div>
            </section>
        </main>

        <footer class="py-12 px-6 lg:px-24 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-white/30 font-mono text-[10px] uppercase tracking-widest">
            <div>${t.footer.copy}</div>
            ${(t.socials && t.socials.visible !== false) ? `
            <div class="flex gap-8">
                ${t.socials.instagram_url ? `<a href="${t.socials.instagram_url}" target="_blank" rel="noopener noreferrer" class="hover:text-white transition-colors">${t.socials.instagram_label || 'Instagram'}</a>` : ''}
                ${t.socials.vimeo_url ? `<a href="${t.socials.vimeo_url}" target="_blank" rel="noopener noreferrer" class="hover:text-white transition-colors">${t.socials.vimeo_label || 'Vimeo'}</a>` : ''}
                ${t.socials.behance_url ? `<a href="${t.socials.behance_url}" target="_blank" rel="noopener noreferrer" class="hover:text-white transition-colors">${t.socials.behance_label || 'Behance'}</a>` : ''}
            </div>` : ''}
            <div>${t.footer.designed}</div>
        </footer>

        <!-- Privacy Policy Modal -->
        ${privacyModalOpen ? `
        <div class="fixed inset-0 z-[998] flex items-center justify-center p-4 lg:p-12 text-white">
            <div class="absolute inset-0 bg-black/90 backdrop-blur-sm" data-action="close-privacy"></div>
            <div class="relative bg-zinc-950 border border-white/10 rounded-sm max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
                <div class="flex items-center justify-between px-8 py-6 border-b border-white/10">
                    <h2 class="font-display text-2xl uppercase tracking-tight text-white">${t.contact.privacy_modal_title}</h2>
                    <button data-action="close-privacy" class="p-2 hover:text-accent transition-colors">
                        <i data-feather="x" class="w-6 h-6 pointer-events-none"></i>
                    </button>
                </div>
                <div class="overflow-y-auto px-8 py-6 privacy-content text-white/80 font-sans text-sm leading-relaxed">
                    ${t.privacy.html}
                </div>
                <div class="px-8 py-5 border-t border-white/10 flex justify-end">
                    <button data-action="close-privacy" class="px-8 py-3 border border-white/20 hover:bg-white hover:text-black transition-all duration-300 font-display uppercase tracking-widest text-sm rounded-full">${t.contact.privacy_modal_close}</button>
                </div>
            </div>
        </div>` : ''}

        <!-- Lightbox -->
        ${lightboxState.isOpen ? (() => {
            const photo = lightboxState.photos[lightboxState.currentIndex];
            return `
            <div class="fixed inset-0 z-[999] bg-black text-white" data-action="toggle-lightbox-text">
                
                <!-- Image: fills entire screen -->
                <img
                    src="${photo.url}"
                    alt="${photo.title}"
                    class="absolute inset-0 w-full h-full object-contain pointer-events-none select-none cursor-pointer"
                >

                <!-- Bottom gradient overlay with description -->
                ${lightboxTextVisible ? `
                <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent px-6 pb-8 pt-32 pointer-events-none z-[201]">
                    <div class="max-w-3xl mx-auto">
                        <p class="text-white/90 font-light leading-relaxed ${getDynamicText('body')} mb-3">${photo.description}</p>
                        <p class="text-white/30 text-xs font-mono tracking-widest">${lightboxState.currentIndex + 1} / ${lightboxState.photos.length}</p>
                    </div>
                </div>` : `
                <div class="absolute bottom-4 left-1/2 -translate-x-1/2 z-[201] pointer-events-none">
                    <p class="text-white/20 text-xs font-mono tracking-widest">${lightboxState.currentIndex + 1} / ${lightboxState.photos.length}</p>
                </div>`}

                <!-- Top-left: language/text-size controls -->
                <div class="absolute top-0 left-0 flex gap-4 font-mono text-xs tracking-widest uppercase z-[1000] p-5 items-center bg-gradient-to-b from-black/60 to-transparent pointer-events-auto">
                    <button data-action="toggle-text-size" class="p-2 -m-2 text-white/80 hover:text-white transition-colors" title="Tamaño de texto"><i data-feather="type" class="w-4 h-4"></i></button>
                    <span class="text-white/20">|</span>
                    <button data-action="set-lang" data-lang="es" class="p-2 -m-2 ${currentLang === 'es' ? 'text-accent' : 'text-white/80 hover:text-white transition-colors'}">${t.nav.lang_es}</button>
                    <button data-action="set-lang" data-lang="ca" class="p-2 -m-2 ${currentLang === 'ca' ? 'text-accent' : 'text-white/80 hover:text-white transition-colors'}">${t.nav.lang_ca}</button>
                    <button data-action="set-lang" data-lang="en" class="p-2 -m-2 ${currentLang === 'en' ? 'text-accent' : 'text-white/80 hover:text-white transition-colors'}">${t.nav.lang_en}</button>
                </div>

                <!-- Top-right: close + text-toggle buttons -->
                <div class="absolute top-4 right-4 lg:top-6 lg:right-6 flex flex-col gap-2 z-[1000]">
                    <button data-action="close-lightbox" class="p-3 text-white hover:text-accent transition-colors bg-black/40 rounded-full backdrop-blur-sm">
                        <i data-feather="x" class="w-6 h-6 pointer-events-none"></i>
                    </button>
                    <button data-action="toggle-lightbox-text" class="p-3 transition-colors bg-black/40 rounded-full backdrop-blur-sm ${lightboxTextVisible ? 'text-white hover:text-accent' : 'text-accent hover:text-white'}" title="${lightboxTextVisible ? 'Ocultar texto' : 'Mostrar texto'}">
                        <i data-feather="${lightboxTextVisible ? 'eye' : 'eye-off'}" class="w-6 h-6 pointer-events-none"></i>
                    </button>
                </div>

                <!-- Prev button -->
                ${lightboxState.currentIndex > 0 ? `
                <button data-action="lightbox-prev" class="absolute left-3 top-1/2 -translate-y-1/2 p-3 text-white hover:text-accent transition-colors z-[1000] bg-black/40 rounded-full backdrop-blur-sm">
                    <i data-feather="chevron-left" class="w-7 h-7 pointer-events-none"></i>
                </button>` : ''}

                <!-- Next button -->
                ${lightboxState.currentIndex < lightboxState.photos.length - 1 ? `
                <button data-action="lightbox-next" class="absolute right-3 top-1/2 -translate-y-1/2 p-3 text-white hover:text-accent transition-colors z-[1000] bg-black/40 rounded-full backdrop-blur-sm">
                    <i data-feather="chevron-right" class="w-7 h-7 pointer-events-none"></i>
                </button>` : ''}

                <!-- Audio button (if available) -->
                ${photo.audioUrl ? `
                <button data-action="lightbox-audio" class="absolute bottom-6 right-6 z-[1000] bg-black/60 rounded-full p-4 backdrop-blur-md border border-white/20 flex items-center justify-center gap-3 hover:bg-black/80 transition-all shadow-xl pointer-events-auto">
                    <i data-feather="headphones" class="w-5 h-5 text-white pointer-events-none stroke-white"></i>
                    <i data-feather="${lightboxState.playing ? 'pause' : 'play'}" class="w-4 h-4 text-white pointer-events-none fill-white stroke-white"></i>
                </button>` : ''}
            </div>`;
        })() : ''}
    `;

    // Restore form state
    if (savedForm) {
        document.getElementById('cf-nombre').value = savedForm.nombre;
        document.getElementById('cf-email').value = savedForm.email;
        document.getElementById('cf-telefono').value = savedForm.telefono;
        document.getElementById('cf-motivo').value = savedForm.motivo;
        document.getElementById('cf-mensaje').value = savedForm.mensaje;
        const consentEl = document.getElementById('cf-consent');
        if (consentEl) consentEl.checked = savedForm.consent;
    }

    feather.replace();
}

// Event Delegation
document.getElementById('app').addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.getAttribute('data-action');
    
    if (action === 'toggle-text-size') {
        e.stopPropagation();
        let idx = textSizeLevels.indexOf(currentTextSize);
        idx = (idx + 1) % textSizeLevels.length;
        currentTextSize = textSizeLevels[idx];
        localStorage.setItem('maisse_text_size', currentTextSize);
        renderApp();
        return;
    }
    
    if (action === 'set-lang') {
        currentLang = target.getAttribute('data-lang');
        localStorage.setItem('maisse_lang', currentLang);
        
        if (lightboxState.isOpen && lightboxState.roomId) {
            const room = window.translations[currentLang].rooms.find(r => r.id === lightboxState.roomId);
            if (room) lightboxState.photos = room.photos;
            
            if (lightboxState.audio) {
                lightboxState.audio.pause();
                lightboxState.playing = false;
                lightboxState.audio = null;
            }
        }
        
        renderApp();
        return;
    }
    
    if (action === 'toggle-menu') {
        isMenuOpen = !isMenuOpen;
        renderApp();
        return;
    }

    if (action === 'open-privacy') {
        e.stopPropagation();
        // Track whether the modal was triggered by clicking the checkbox itself
        privacyOpenedFromCheckbox = (e.target.id === 'cf-consent' || e.target.closest('#cf-consent') !== null);
        privacyModalOpen = true;
        document.body.style.overflow = 'hidden';
        renderApp();
        return;
    }

    if (action === 'close-privacy') {
        privacyModalOpen = false;
        privacyRead = true;
        setCookie('maisse_privacy_read', '1', 4); // remember for 4 hours
        document.body.style.overflow = 'auto';
        renderApp();
        // Auto-check only when the modal was opened by clicking the checkbox
        if (privacyOpenedFromCheckbox) {
            const consentEl = document.getElementById('cf-consent');
            if (consentEl) {
                consentEl.checked = true;
                // Also enable the submit button
                const submitBtn = document.getElementById('cf-submit');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.classList.remove('border-white/10', 'text-white/30', 'cursor-not-allowed');
                    submitBtn.classList.add('border-white/20', 'hover:bg-white', 'hover:text-black', 'cursor-pointer');
                }
            }
        }
        privacyOpenedFromCheckbox = false;
        return;
    }

    if (action === 'play-external-audio') {
        e.stopPropagation();
        const targetId = target.getAttribute('data-photo-id') || target.getAttribute('data-id');
        const audioUrlFromAttr = target.getAttribute('data-audio-url');
        
        if (playingExternalId === targetId) {
            externalAudio.pause();
            playingExternalId = null;
            renderApp();
        } else {
            if (externalAudio) externalAudio.pause();
            
            // Get correct audioUrl
            let foundAudioUrl = audioUrlFromAttr;
            if (!foundAudioUrl) {
                const rooms = window.translations[currentLang].rooms;
                for (const room of rooms) {
                    const photo = room.photos.find(p => p.id === targetId);
                    if (photo) {
                        foundAudioUrl = photo.audioUrl;
                        break;
                    }
                }
            }
            if (!foundAudioUrl) return;

            externalAudio = new Audio(foundAudioUrl);
            externalAudio.play();
            playingExternalId = targetId;
            externalAudio.onended = () => {
                playingExternalId = null;
                renderApp();
            };
            renderApp();
        }
        return;
    }
    
    if (action === 'open-lightbox') {
        const roomId = target.getAttribute('data-room-id');
        const photoId = target.getAttribute('data-photo-id');
        const room = window.translations[currentLang].rooms.find(r => r.id === roomId);
        if (room) {
            const index = room.photos.findIndex(p => p.id === photoId);
            if (index !== -1) {
                // Pause any external audio when opening lightbox
                if (externalAudio) {
                    externalAudio.pause();
                    playingExternalId = null;
                }
                lightboxState = { isOpen: true, photos: room.photos, currentIndex: index, playing: false, audio: null, roomId: roomId };
                document.body.style.overflow = 'hidden';
                window.history.pushState(null, '', `#photo-${photoId}`);
                renderApp();
            }
        }
        return;
    }
    
    if (action === 'toggle-lightbox-text') {
        e.stopPropagation();
        lightboxTextVisible = !lightboxTextVisible;
        renderApp();
        return;
    }

    if (action === 'close-lightbox') {
        if (lightboxState.audio) {
            lightboxState.audio.pause();
        }
        lightboxState.isOpen = false;
        lightboxState.audio = null;
        lightboxState.playing = false;
        document.body.style.overflow = 'auto';
        history.replaceState(null, '', window.location.pathname + window.location.search);
        renderApp();
        return;
    }
    
    if (action === 'lightbox-next') {
        e.stopPropagation();
        if (lightboxState.audio) {
            lightboxState.audio.pause();
            lightboxState.playing = false;
        }
        lightboxState.currentIndex++;
        window.history.replaceState(null, '', `#photo-${lightboxState.photos[lightboxState.currentIndex].id}`);
        renderApp();
        return;
    }
    
    if (action === 'lightbox-prev') {
        e.stopPropagation();
        if (lightboxState.audio) {
            lightboxState.audio.pause();
            lightboxState.playing = false;
        }
        lightboxState.currentIndex--;
        window.history.replaceState(null, '', `#photo-${lightboxState.photos[lightboxState.currentIndex].id}`);
        renderApp();
        return;
    }
    
    if (action === 'lightbox-audio') {
        e.stopPropagation();
        if (lightboxState.playing) {
            lightboxState.audio.pause();
            lightboxState.playing = false;
            renderApp();
        } else {
            if (!lightboxState.audio) {
                const photo = lightboxState.photos[lightboxState.currentIndex];
                if (!photo || !photo.audioUrl) return;
                lightboxState.audio = new Audio(photo.audioUrl);
                lightboxState.audio.onended = () => {
                    lightboxState.playing = false;
                    renderApp();
                };
            }
            lightboxState.audio.play();
            lightboxState.playing = true;
            renderApp();
        }
        return;
    }
});

// Dynamically enable/disable submit based on consent checkbox state
document.getElementById('app').addEventListener('change', (e) => {
    if (e.target.id === 'cf-consent') {
        const submitBtn = document.getElementById('cf-submit');
        if (!submitBtn) return;
        if (e.target.checked) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('border-white/10', 'text-white/30', 'cursor-not-allowed');
            submitBtn.classList.add('border-white/20', 'hover:bg-white', 'hover:text-black', 'cursor-pointer');
        } else {
            submitBtn.disabled = true;
            submitBtn.classList.add('border-white/10', 'text-white/30', 'cursor-not-allowed');
            submitBtn.classList.remove('border-white/20', 'hover:bg-white', 'hover:text-black', 'cursor-pointer');
        }
    }
});

// Contact Form Submission
const WORKER_URL = 'https://enviar-telegram-somni.salva-mira.workers.dev';

document.getElementById('app').addEventListener('submit', async (e) => {
    if (e.target.id !== 'contact-form') return;
    e.preventDefault();

    const t = window.translations[currentLang];
    const statusEl = document.getElementById('cf-status');
    const submitBtn = document.getElementById('cf-submit');
    const originalText = submitBtn.textContent;

    const nombre = document.getElementById('cf-nombre').value.trim();
    const email = document.getElementById('cf-email').value.trim();
    const telefono = document.getElementById('cf-telefono').value.trim();
    const motivo = document.getElementById('cf-motivo').value;
    const mensaje = document.getElementById('cf-mensaje').value.trim();
    const consentCheck = document.getElementById('cf-consent');

    // Basic validation — also double-check consent (defence in depth)
    if (!nombre || !email || !motivo || !mensaje) return;
    if (!consentCheck || !consentCheck.checked) {
        statusEl.textContent = t.contact.form_privacy_pending;
        statusEl.className = 'text-center font-mono text-sm tracking-wider py-3 px-5 rounded-sm bg-yellow-900/30 border border-yellow-500/30 text-yellow-300';
        return;
    }

    const consentTimestamp = new Date().toISOString();
    const consentFormatted = new Date().toLocaleString(currentLang === 'en' ? 'en-GB' : 'es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
    });

    // Loading state
    submitBtn.textContent = t.contact.form_sending;
    submitBtn.disabled = true;
    statusEl.className = 'hidden';

    try {
        const response = await fetch(WORKER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email, telefono, motivo, mensaje, consentimiento: true, fecha: consentFormatted })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            statusEl.textContent = t.contact.form_success;
            statusEl.className = 'text-center font-mono text-sm tracking-wider py-3 px-5 rounded-sm bg-green-900/40 border border-green-500/30 text-green-300';
            e.target.reset();
        } else {
            throw new Error('Server error');
        }
    } catch (err) {
        statusEl.textContent = t.contact.form_error;
        statusEl.className = 'text-center font-mono text-sm tracking-wider py-3 px-5 rounded-sm bg-red-900/40 border border-red-500/30 text-red-300';
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

// Deep Link hashing
function handleHash() {
    const hash = window.location.hash;
    if (hash.startsWith('#photo-')) {
        const photoId = hash.replace('#photo-', '');
        for (const room of window.translations[currentLang].rooms) {
            const index = room.photos.findIndex(p => p.id === photoId);
            if (index !== -1) {
                if (externalAudio) {
                    externalAudio.pause();
                    playingExternalId = null;
                }
                lightboxState = { isOpen: true, photos: room.photos, currentIndex: index, playing: false, audio: null, roomId: room.id };
                document.body.style.overflow = 'hidden';
                renderApp();
                return;
            }
        }
    }
}
window.addEventListener('hashchange', handleHash);

// Boot
renderApp();
handleHash();
