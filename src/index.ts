import express from "express";
import { Server, StableBTreeMap } from "azle";
import { v4 as uuidv4 } from 'uuid';

// Define interfaces for data structures
interface Ticket {
    id: string;
    eventId: string;
    owner: string;
    isUsed: boolean;
}

interface Event {
    id: string;
    name: string;
    date: string;
    venue: string;
    tickets: Ticket[];
    isOpen: boolean;
}

interface Owner {
    username: string;
    password: string;
}

const owners = StableBTreeMap<string, Owner>(2);
const events = StableBTreeMap<string, Event>(0);
const tickets = StableBTreeMap<string, Ticket>(1);

// Middleware to authenticate owner
function authenticateOwner(req: express.Request, res: express.Response, next: express.NextFunction) {
    const username = req.headers["username"] as string;
    const password = req.headers["password"] as string;

    const ownerOpt = owners.get(username);

    if (!ownerOpt || ownerOpt.password !== password) {
        res.status(401).send("Unauthorized");
    } else {
        next();
    }
}

// Define the server
export default Server(() =>  {
    const app = express();
    app.use(express.json());

    // Route to create an event
    app.post("/events", (req, res) => {
        const event: Event = { id: uuidv4(), tickets: [], isOpen: true, ...req.body };
        events.insert(event.id, event);
        res.json(event);
    });

    // Route to get all events
    app.get("/events", (req, res) => {
        res.json(events.values());
    });

    // Route to get event details
    app.get("/events/:eventId", (req, res) => {
        const eventId = req.params.eventId;
        const eventOpt = events.get(eventId);
        if ("None" in eventOpt) {
            res.status(404).send(`Event with id=${eventId} not found`);
        } else {
            res.json(eventOpt.Some);
        }
    });

    // Route to buy a ticket for an event
    app.post("/events/:eventId/tickets", (req, res) => {
        const eventId = req.params.eventId;
        const eventOpt = events.get(eventId);
        if ("None" in eventOpt) {
            res.status(404).send(`Event with id=${eventId} not found`);
        } else {
            const ticket: Ticket = { id: uuidv4(), eventId, isUsed: false, owner: req.body.owner };
            tickets.insert(ticket.id, ticket);
            events.insert(eventId, { ...eventOpt.Some, tickets: [...eventOpt.Some.tickets, ticket] });
            res.json(ticket);
        }
    });

    // Route to use a ticket
    app.put("/tickets/:ticketId/use", (req, res) => {
        const ticketId = req.params.ticketId;
        const ticketOpt = tickets.get(ticketId);
        if ("None" in ticketOpt) {
            res.status(404).send(`Ticket with id=${ticketId} not found`);
        } else {
            const ticket = ticketOpt.Some;
            tickets.insert(ticketId, { ...ticket, isUsed: true });
            const eventId = ticket.eventId;
            const eventOpt = events.get(eventId);
            if ("Some" in eventOpt) {
                const updatedTickets = eventOpt.Some.tickets.map(t => t.id === ticketId ? { ...t, isUsed: true } : t);
                events.insert(eventId, { ...eventOpt.Some, tickets: updatedTickets });
            }
            res.json({ message: `Ticket with id=${ticketId} used successfully` });
        }
    });

    return app.listen();
});
