import React from 'react';
import Link from 'next/link';
import {
    Construction,
    Github,
    ExternalLink,
    Heart,
    Code2,
    Users,
    Mail,
    Globe
} from 'lucide-react';

const Footer: React.FC = () => {
    const quickLinks = [
        { href: '/', label: 'Home' },
        { href: '/closures', label: 'View Closures' },
        { href: '/docs', label: 'API Documentation', external: true },
	{ href: '/privacy', label: 'Privacy Policy' },
        { href: 'https://github.com/sosm/temporary-road-closures', label: 'GitHub Repository', external: true }
    ];

    const technologies = [
        'Next.js', 'TypeScript', 'FastAPI', 'PostgreSQL',
        'PostGIS', 'OpenLR', 'Leaflet', 'Tailwind CSS'
    ];

    return (
        <footer className="bg-gray-900 text-white">
            {/* Main Footer Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
                <div className="grid lg:grid-cols-4 gap-8 lg:gap-12">

                    {/* Quick Links */}
                    <div>
                        <h4 className="text-lg font-semibold text-white mb-6">Quick Links</h4>
			<ul className="flex flex-col gap-3 md:flex-row md:flex-nowrap md:items-center md:gap-5">

                            {quickLinks.map((link, index) => (
                                <li key={index} className="whitespace-nowrap">
                                    {link.external ? (
                                        <a
                                            href={link.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-gray-300 hover:text-white transition-colors flex items-center group"
                                        >
                                            {link.label}
                                            <ExternalLink className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </a>
                                    ) : (
                                        <Link
                                            href={link.href}
                                            className="text-gray-300 hover:text-white transition-colors"
                                        >
                                            {link.label}
                                        </Link>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-gray-800 bg-gray-950">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                        <div className="text-gray-400 text-sm text-center md:text-left">
                            <p>
                                © 2026 OSM Road Closures Project.
                                Open source under MIT License.
                            </p>
                            <p className="mt-1">
                                Built with ❤️ for the OpenStreetMap community, supported by the <a href="https://sosm.ch/">Swiss OpenStreetMap Association</a>.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
